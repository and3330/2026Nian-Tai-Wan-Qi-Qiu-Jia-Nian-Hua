import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import {
  cleanupTestRows,
  makeTestApp,
  seedParticipants,
  testEmail,
  testName,
  tournamentRegistered,
} from "./helpers";

const TOURNAMENT_CAPACITY = 128;
const TOURNAMENT_DATE = "2026-07-26";
const PARTICIPANT_PRICE = 600;
const COMPANION_PRICE = 200;

let app: Express;

beforeAll(() => {
  app = makeTestApp();
});

afterEach(async () => {
  await cleanupTestRows();
});

afterAll(async () => {
  await cleanupTestRows();
});

describe("POST /api/registrations/tournament — happy path", () => {
  it("creates a participant leg plus a companion leg with their own amount and qrToken", async () => {
    const res = await request(app)
      .post("/api/registrations/tournament")
      .send({ parentName: testName("p-"), phone: "0911222333", email: testEmail(), mode: "participant", companionCount: 2 });

    expect(res.status).toBe(201);
    const regs = res.body.registrations as Array<Record<string, any>>;
    expect(regs).toHaveLength(2);

    const participant = regs.find((r) => r.ticketType === "tournament");
    const companion = regs.find((r) => r.ticketType === "tournament-companion");
    expect(participant).toBeTruthy();
    expect(companion).toBeTruthy();

    // Participant leg: own entry, 1 seat, 600, own QR, on 7/26.
    expect(participant!.ticketCount).toBe(1);
    expect(participant!.amount).toBe(PARTICIPANT_PRICE);
    expect(participant!.eventDate).toBe(TOURNAMENT_DATE);
    expect(typeof participant!.qrToken).toBe("string");
    expect(participant!.qrToken.length).toBeGreaterThan(8);

    // Companion leg: N seats in one row, full N x unit price, its own QR.
    expect(companion!.ticketCount).toBe(2);
    expect(companion!.amount).toBe(COMPANION_PRICE * 2);
    expect(typeof companion!.qrToken).toBe("string");

    // Each leg carries a distinct QR token.
    expect(participant!.qrToken).not.toBe(companion!.qrToken);
  });

  it("creates a single participant leg when companionCount is 0", async () => {
    const res = await request(app)
      .post("/api/registrations/tournament")
      .send({ parentName: testName("solo-"), phone: "0911000000", email: testEmail(), mode: "participant", companionCount: 0 });

    expect(res.status).toBe(201);
    expect(res.body.registrations).toHaveLength(1);
    expect(res.body.registrations[0].ticketType).toBe("tournament");
  });

  it("spectator mode creates only a companion leg and consumes no participant slot", async () => {
    const before = await tournamentRegistered();
    const res = await request(app)
      .post("/api/registrations/tournament")
      .send({ parentName: testName("spec-"), phone: "0922000000", email: testEmail(), mode: "spectator", companionCount: 3 });

    expect(res.status).toBe(201);
    expect(res.body.registrations).toHaveLength(1);
    const leg = res.body.registrations[0];
    expect(leg.ticketType).toBe("tournament-companion");
    expect(leg.ticketCount).toBe(3);
    expect(leg.amount).toBe(COMPANION_PRICE * 3);

    const after = await tournamentRegistered();
    expect(after).toBe(before);
  });
});

describe("POST /api/registrations/tournament — capacity (128 cap)", () => {
  it("companions do not consume the 128 participant cap", async () => {
    const before = await tournamentRegistered();
    await request(app)
      .post("/api/registrations/tournament")
      .send({ parentName: testName("cap-"), phone: "0933000000", email: testEmail(), mode: "participant", companionCount: 5 })
      .expect(201);

    const after = await tournamentRegistered();
    // Exactly one participant seat consumed regardless of 5 companions.
    expect(after).toBe(before + 1);
  });

  it("returns 409 SOLD_OUT when a participant would exceed the remaining cap", async () => {
    const before = await tournamentRegistered();
    const toFill = TOURNAMENT_CAPACITY - before;
    expect(toFill).toBeGreaterThanOrEqual(0);
    await seedParticipants(toFill);

    const res = await request(app)
      .post("/api/registrations/tournament")
      .send({ parentName: testName("over-"), phone: "0944000000", email: testEmail(), mode: "participant", companionCount: 0 });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("SOLD_OUT");
    expect(res.body.remaining).toBe(0);
  });

  it("spectator-only purchases still succeed when the participant cap is full", async () => {
    const before = await tournamentRegistered();
    await seedParticipants(TOURNAMENT_CAPACITY - before);

    const res = await request(app)
      .post("/api/registrations/tournament")
      .send({ parentName: testName("specfull-"), phone: "0955000000", email: testEmail(), mode: "spectator", companionCount: 2 });

    expect(res.status).toBe(201);
    expect(res.body.registrations[0].ticketType).toBe("tournament-companion");
  });

  it("serializes concurrent participant purchases so the cap is never oversold", async () => {
    const before = await tournamentRegistered();
    // Leave exactly one open slot, then fire two concurrent participant buys.
    await seedParticipants(TOURNAMENT_CAPACITY - before - 1);

    const [a, b] = await Promise.all([
      request(app)
        .post("/api/registrations/tournament")
        .send({ parentName: testName("race-a-"), phone: "0966000000", email: testEmail(), mode: "participant", companionCount: 0 }),
      request(app)
        .post("/api/registrations/tournament")
        .send({ parentName: testName("race-b-"), phone: "0966000001", email: testEmail(), mode: "participant", companionCount: 0 }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    expect(await tournamentRegistered()).toBe(TOURNAMENT_CAPACITY);
  });
});

describe("GET /api/registrations/tournament/availability", () => {
  it("reports capacity, registered and remaining consistently", async () => {
    const res = await request(app).get("/api/registrations/tournament/availability");
    expect(res.status).toBe(200);
    expect(res.body.capacity).toBe(TOURNAMENT_CAPACITY);
    expect(res.body.registered + res.body.remaining).toBe(TOURNAMENT_CAPACITY);
    expect(res.body.soldOut).toBe(res.body.remaining <= 0);
  });

  it("decrements remaining by one per participant (not per companion)", async () => {
    const before = (await request(app).get("/api/registrations/tournament/availability")).body.remaining;
    await request(app)
      .post("/api/registrations/tournament")
      .send({ parentName: testName("avail-"), phone: "0977000000", email: testEmail(), mode: "participant", companionCount: 4 })
      .expect(201);
    const after = (await request(app).get("/api/registrations/tournament/availability")).body.remaining;
    expect(after).toBe(before - 1);
  });
});

describe("Tournament isolation from the general 500/day carnival cap", () => {
  it("tournament participants do not reduce the 7/26 general availability", async () => {
    const availabilityFor = async (date: string) => {
      const res = await request(app).get("/api/registrations/availability");
      const day = (res.body as Array<any>).find((d) => String(d.date).slice(0, 10) === date);
      return day.remaining as number;
    };

    const beforeGeneral = await availabilityFor(TOURNAMENT_DATE);
    await request(app)
      .post("/api/registrations/tournament")
      .send({ parentName: testName("iso-"), phone: "0988000000", email: testEmail(), mode: "participant", companionCount: 3 })
      .expect(201);
    const afterGeneral = await availabilityFor(TOURNAMENT_DATE);
    expect(afterGeneral).toBe(beforeGeneral);

    // And a general 7/26 admission still consumes only general inventory.
    const beforeReg = await availabilityFor(TOURNAMENT_DATE);
    await request(app)
      .post("/api/registrations")
      .send({ parentName: testName("gen-"), phone: "0988111111", email: testEmail(), ticketCount: 2, eventDate: TOURNAMENT_DATE, ticketType: "single", amount: 400 })
      .expect(201);
    const afterReg = await availabilityFor(TOURNAMENT_DATE);
    expect(afterReg).toBe(beforeReg - 2);
  });
});

describe("POST /api/registrations/tournament — input validation", () => {
  const base = () => ({ parentName: testName("v-"), phone: "0999000000", email: testEmail() });

  it("rejects a missing/invalid mode", async () => {
    await request(app).post("/api/registrations/tournament").send({ ...base() }).expect(400);
    await request(app).post("/api/registrations/tournament").send({ ...base(), mode: "bogus" }).expect(400);
  });

  it("rejects a missing parentName", async () => {
    await request(app)
      .post("/api/registrations/tournament")
      .send({ phone: "0999000000", email: testEmail(), mode: "participant", companionCount: 0 })
      .expect(400);
  });

  it("rejects a missing phone", async () => {
    await request(app)
      .post("/api/registrations/tournament")
      .send({ parentName: testName("v-"), email: testEmail(), mode: "participant", companionCount: 0 })
      .expect(400);
  });

  it("rejects a missing or malformed email", async () => {
    await request(app)
      .post("/api/registrations/tournament")
      .send({ parentName: testName("v-"), phone: "0999000000", mode: "participant", companionCount: 0 })
      .expect(400);
    await request(app)
      .post("/api/registrations/tournament")
      .send({ ...base(), email: "not-an-email", mode: "participant", companionCount: 0 })
      .expect(400);
  });

  it("rejects companionCount out of range or non-integer", async () => {
    await request(app).post("/api/registrations/tournament").send({ ...base(), mode: "participant", companionCount: -1 }).expect(400);
    await request(app).post("/api/registrations/tournament").send({ ...base(), mode: "participant", companionCount: 21 }).expect(400);
    await request(app).post("/api/registrations/tournament").send({ ...base(), mode: "participant", companionCount: 1.5 }).expect(400);
  });

  it("requires at least one companion in spectator mode", async () => {
    await request(app).post("/api/registrations/tournament").send({ ...base(), mode: "spectator", companionCount: 0 }).expect(400);
    await request(app).post("/api/registrations/tournament").send({ ...base(), mode: "spectator", companionCount: 1 }).expect(201);
  });
});
