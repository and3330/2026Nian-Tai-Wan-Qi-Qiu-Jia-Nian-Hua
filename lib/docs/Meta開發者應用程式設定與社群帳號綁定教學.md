# Meta 開發者應用程式設定與社群帳號綁定教學

**2026 臺灣氣球嘉年華** — 從零開始綁定 Facebook、Instagram、Threads 社群帳號

本文件會一步步帶你完成：
1. 在 Meta 開發者平台建立應用程式，取得 App ID 和 App Secret
2. 將這些資訊填入系統
3. 在後台完成 Facebook、Instagram、Threads 的帳號綁定

---

## 目錄

- [事前準備](#事前準備)
- [第一部分：建立 Meta 開發者應用程式（Facebook + Instagram 共用）](#第一部分建立-meta-開發者應用程式facebook--instagram-共用)
- [第二部分：為應用程式新增「Facebook 登入」產品](#第二部分為應用程式新增facebook-登入產品)
- [第三部分：設定 OAuth 重新導向 URI（Facebook）](#第三部分設定-oauth-重新導向-urifacebook)
- [第四部分：建立 Threads 應用程式](#第四部分建立-threads-應用程式)
- [第五部分：將 App ID 和 App Secret 填入系統](#第五部分將-app-id-和-app-secret-填入系統)
- [第六部分：在後台綁定社群帳號](#第六部分在後台綁定社群帳號)
- [常見問題](#常見問題)

---

## 事前準備

在開始之前，請先確認你已經有以下東西：

| 項目 | 說明 |
|------|------|
| Facebook 個人帳號 | 用來登入 Meta 開發者平台（不是粉專，是你個人的 FB 帳號） |
| Facebook 粉絲專頁 | 你要用來發文的粉專（例如「2026 臺灣氣球嘉年華」粉專） |
| Instagram 商業帳號 | 必須是「商業帳號」或「創作者帳號」，且已與 Facebook 粉專綁定 |
| Threads 帳號 | 你要用來發文的 Threads 帳號 |
| 網站網址 | 你的氣球嘉年華網站的正式網址 |

### 如何確認 Instagram 是商業帳號？

1. 打開 Instagram App → 點右下角大頭貼 → 點右上角「☰」→「設定和隱私」
2. 點「帳號類型和工具」→「切換為專業帳號」
3. 選擇「商業」類別
4. 在設定中選擇「連結的帳號」→ 連結你的 Facebook 粉絲專頁

> ⚠️ **重要**：Instagram 必須是商業帳號且已綁定 Facebook 粉專，系統才能自動偵測到它。

---

## 第一部分：建立 Meta 開發者應用程式（Facebook + Instagram 共用）

Facebook 和 Instagram 使用同一個 Meta 應用程式，所以只需要建一個。

### 步驟 1：進入 Meta 開發者平台

1. 打開瀏覽器，前往 **https://developers.facebook.com**
2. 點右上角「登入」，用你的 Facebook 個人帳號登入
3. 如果是第一次使用，系統會要求你同意開發者條款，勾選後按「繼續」

### 步驟 2：建立新應用程式

1. 登入後，點右上角「我的應用程式」
2. 點綠色的「建立應用程式」按鈕
3. 選擇應用程式的使用情境：
   - 選「其他」→ 點「下一步」
4. 選擇應用程式類型：
   - 選「商業」→ 點「下一步」
5. 填寫應用程式資訊：
   - **應用程式名稱**：輸入 `2026臺灣氣球嘉年華` （或你想要的名稱）
   - **應用程式聯絡電子郵件**：填入你的 Email
   - **商業帳號**：如果有 Meta 商業帳號可以選擇，沒有的話選「我目前不想連結商業帳號」
6. 點「建立應用程式」
7. 可能需要輸入 Facebook 密碼做驗證

### 步驟 3：記下 App ID 和 App Secret

應用程式建立完成後：

1. 你會進到應用程式的「主控板」頁面
2. 在左側選單點「設定」→「基本資料」
3. 你會看到兩個重要資訊：
   - **應用程式編號（App ID）**：一串數字，例如 `123456789012345`
   - **應用程式密鑰（App Secret）**：點「顯示」按鈕，輸入密碼後會顯示一串英數字
4. **把這兩個值複製下來，先記在安全的地方**（等等要填入系統）

> 📋 範例：
> - App ID：`123456789012345`
> - App Secret：`a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4`

### 步驟 4：填寫基本設定

還在「設定」→「基本資料」頁面，往下滾動填寫：

1. **應用程式網域**：填入你的網站網域（例如 `你的網站.replit.app`，不要加 https://）
2. **隱私政策網址**：填入 `https://你的網站.replit.app/privacy`（如果還沒有可以先填首頁）
3. **網站網址**：在「網站」區塊，點「+新增平台」→ 選「網站」→ 填入 `https://你的網站.replit.app`
4. 點「儲存變更」

---

## 第二部分：為應用程式新增「Facebook 登入」產品

### 步驟 1：新增產品

1. 在左側選單找到「新增產品」（或在主控板找到「將產品新增到你的應用程式」）
2. 找到「Facebook 登入」→ 點「設定」
3. 選「網站」作為平台
4. 網站網址填入你的網站網址 → 點「儲存」→ 點「繼續」
5. 後面的快速入門步驟可以直接跳過（點左側選單的其他項目即可）

### 步驟 2：確認權限

1. 在左側選單找到「應用程式審查」→「權限與功能」
2. 確認以下權限已啟用（開發模式下預設可用）：
   - `pages_manage_posts` — 管理粉專貼文
   - `pages_read_engagement` — 讀取粉專互動數據
   - `pages_show_list` — 顯示粉專清單
   - `business_management` — 商業管理

> 💡 **提示**：在「開發模式」下，這些權限只對應用程式管理員和測試人員有效，這對我們來說已經夠用了。如果之後要讓其他人也能使用，才需要提交審查申請。

---

## 第三部分：設定 OAuth 重新導向 URI（Facebook）

這一步非常重要，告訴 Meta 授權完成後要把使用者導回哪裡。

### 步驟 1：進入 Facebook 登入設定

1. 在左側選單展開「Facebook 登入」→ 點「設定」
2. 找到「有效的 OAuth 重新導向 URI」欄位

### 步驟 2：新增重新導向 URI

在「有效的 OAuth 重新導向 URI」欄位填入：

```
https://你的網站網域/api/admin/social-accounts/oauth-callback/facebook
```

例如，如果你的網站是 `https://balloon-carnival.replit.app`，就填入：

```
https://balloon-carnival.replit.app/api/admin/social-accounts/oauth-callback/facebook
```

然後點「儲存變更」。

> ⚠️ **注意事項**：
> - 網址必須是 `https://` 開頭
> - 結尾不要多加 `/`
> - 網域必須和上面「基本資料」填的一致

---

## 第四部分：建立 Threads 應用程式

Threads 需要一個獨立的應用程式（不能和 Facebook 共用）。

### 步驟 1：建立 Threads 專用應用程式

1. 回到 **https://developers.facebook.com/apps/**
2. 再點一次「建立應用程式」
3. 使用情境選「其他」→ 下一步
4. 應用程式類型選「商業」→ 下一步
5. 應用程式名稱輸入 `氣球嘉年華Threads`（或任何你想要的名稱，不能和剛才的重複）
6. 點「建立應用程式」

### 步驟 2：新增 Threads 產品

1. 進入新建的應用程式主控板
2. 在「新增產品」區域找到「Threads」→ 點「設定」

### 步驟 3：設定 Threads 重新導向 URI

1. 在 Threads 設定頁面中，找到「重新導向回呼 URL（Redirect Callback URLs）」
2. 填入：

```
https://你的網站網域/api/admin/social-accounts/oauth-callback/threads
```

例如：

```
https://balloon-carnival.replit.app/api/admin/social-accounts/oauth-callback/threads
```

3. 點「儲存」

### 步驟 4：記下 Threads 的 App ID 和 App Secret

1. 在左側選單點「設定」→「基本資料」
2. 記下這個應用程式的：
   - **應用程式編號（App ID）**
   - **應用程式密鑰（App Secret）**
3. **這組和 Facebook 的不一樣，請分開記錄！**

### 步驟 5：新增 Threads 測試人員

1. 在左側選單點「應用程式角色」→「角色」
2. 點「新增人員」→ 找到「Threads 測試人員」
3. 輸入你的 Threads 使用者名稱（就是你的 Instagram 帳號名稱）
4. 送出邀請

接著要到 Threads App 接受邀請：

5. 打開 Threads App → 「設定」→「帳號」→「網站權限」
6. 找到「邀請」區域，接受你剛才送出的測試人員邀請

> ⚠️ **重要**：如果不完成這一步，Threads 授權會失敗！

---

## 第五部分：將 App ID 和 App Secret 填入系統

現在你手上應該有四組資訊：

| 項目 | 來自哪個應用程式 | 範例 |
|------|----------------|------|
| Facebook App ID | 第一個應用程式（Facebook + IG 共用） | `123456789012345` |
| Facebook App Secret | 第一個應用程式（Facebook + IG 共用） | `a1b2c3d4e5f6...` |
| Threads App ID | 第二個應用程式（Threads 專用） | `987654321098765` |
| Threads App Secret | 第二個應用程式（Threads 專用） | `f6e5d4c3b2a1...` |

### 填入方式

在 Replit 專案中設定環境變數（Secrets）：

1. 打開 Replit 專案
2. 點左側工具列的「Secrets」（鑰匙圖示）
3. 新增以下四個環境變數：

| Key（名稱） | Value（值） |
|-------------|------------|
| `FACEBOOK_APP_ID` | 你的 Facebook 應用程式編號 |
| `FACEBOOK_APP_SECRET` | 你的 Facebook 應用程式密鑰 |
| `THREADS_APP_ID` | 你的 Threads 應用程式編號 |
| `THREADS_APP_SECRET` | 你的 Threads 應用程式密鑰 |

4. 每填一個按一次「Add new secret」
5. 全部填完後，重新啟動 API Server

---

## 第六部分：在後台綁定社群帳號

環境變數設定好後，就可以到後台綁定帳號了。

### 綁定 Facebook + Instagram

1. 登入管理後台（`/admin`）
2. 點左側選單「社群帳號」
3. 在 **Facebook** 的卡片上，點「連結帳號」
4. 瀏覽器會跳轉到 Facebook 授權頁面
5. 確認你要授權的身份 → 點「以（你的名字）的身份繼續」
6. 選擇你要綁定的粉絲專頁 → 勾選後點「下一步」
7. 確認所有權限都已勾選 → 點「完成」
8. 頁面會自動跳轉回後台，顯示綁定成功

> 🎉 **Instagram 會自動綁定！** 如果你的 Facebook 粉專有綁定 Instagram 商業帳號，系統會在這一步自動偵測並綁定，你不需要另外操作。

綁定完成後，你會在後台看到：
- Facebook 卡片顯示你的粉專名稱
- Instagram 卡片顯示你的 IG 帳號名稱（如果有綁定的話）

### 綁定 Threads

1. 在社群帳號頁面，找到 **Threads** 的卡片
2. 點「連結帳號」
3. 瀏覽器會跳轉到 Threads 授權頁面
4. 點「允許」授權
5. 頁面會自動跳轉回後台，顯示綁定成功

---

## 常見問題

### Q：為什麼需要兩個應用程式？

Meta 的規定是 Threads API 需要獨立的應用程式，不能與 Facebook 登入共用同一個應用程式的權限設定。

### Q：Instagram 沒有自動出現怎麼辦？

請確認：
1. 你的 Instagram 是「商業帳號」或「創作者帳號」（不是個人帳號）
2. Instagram 已經在 Instagram App 的設定中連結了 Facebook 粉專
3. 你在 Facebook 授權時有勾選正確的粉絲專頁

### Q：授權時出現「重新導向 URI 不符」錯誤？

請檢查：
1. 在 Meta 開發者後台填入的重新導向 URI 和你的實際網址完全一致
2. 網址開頭是 `https://`（不是 `http://`）
3. 網址結尾沒有多餘的 `/`
4. 如果你的網站網域有變更，記得回去更新

### Q：出現「應用程式未上線」或「未經授權」的錯誤？

在開發模式下，只有應用程式的管理員和測試人員可以授權。你（建立應用程式的人）預設就是管理員，所以應該沒問題。如果其他人要使用：
1. 到應用程式的「應用程式角色」→「角色」
2. 新增他們為「測試人員」
3. 他們需要在 Facebook 的通知中接受邀請

### Q：Token 過期了怎麼辦？

系統會自動取得長期 Token（有效期約 60 天）。過期後只需要在後台的社群帳號頁面，點「重新授權」按鈕重新綁定即可。

### Q：App Secret 不小心外洩了怎麼辦？

1. 立即到 Meta 開發者後台「設定」→「基本資料」
2. 點 App Secret 旁邊的「重設」按鈕，產生新的 Secret
3. 到 Replit 的 Secrets 更新對應的環境變數
4. 重新啟動 API Server

---

## 整理：你需要記住的關鍵網址

| 用途 | 網址 |
|------|------|
| Meta 開發者平台 | https://developers.facebook.com |
| 我的應用程式列表 | https://developers.facebook.com/apps/ |
| Facebook 授權回調 | `https://你的網域/api/admin/social-accounts/oauth-callback/facebook` |
| Threads 授權回調 | `https://你的網域/api/admin/social-accounts/oauth-callback/threads` |
| 管理後台社群帳號 | `https://你的網域/admin/social-accounts` |

---

*2026 臺灣氣球嘉年華 — Meta 開發者應用程式設定指南*
