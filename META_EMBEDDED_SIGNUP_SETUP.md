# Meta Embedded Signup – Where to get each ID

**Config takes priority:** The app reads `NEXT_PUBLIC_META_*` from env when set. If not set, App ID and Config ID use built-in defaults in code.

- `NEXT_PUBLIC_META_APP_ID` (default in code: `887322600586927`)
- `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID` (default in code: `2393474544425955`)
- `NEXT_PUBLIC_META_PARTNER_SOLUTION_ID` (no default; from provider after onboarding)

---

## 1. `NEXT_PUBLIC_META_APP_ID`

- **Value:** Your Meta app ID. Default **`887322600586927`** is set in code; set env to override.
- **Where:** [Meta for Developers](https://developers.facebook.com/apps/) → select your app → **Dashboard**. The App ID is shown at the top (and in the “Application Rate Limit” card).

---

## 2. `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID`

This is the **Configuration ID** for **WhatsApp Embedded Signup**. Default **`2393474544425955`** is set in code; set env to override.


**Option A – Via WhatsApp (if your app has WhatsApp product)**  
1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → select your app (e.g. UpZilo).  
2. In the left sidebar, open **Products** and click **WhatsApp**.  
3. Under **WhatsApp**, look for **Embedded Signup** / **ES Integration** (or “Integration” / “Setup”).  
4. In that section you can **Create** or manage **Configurations**. Create one with login variation **WhatsApp Embedded Signup**.  
5. After saving, the **Configuration ID** is shown (a string like `1234567890123456`). Use that as `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID`.

**Option B – Via Facebook Login for Business**  
1. Same app → left sidebar under **Products** click **Facebook Login**.  
2. Check for **Facebook Login for Business** (or “Set Up” / “Settings”).  
3. Open **Configurations** (or “Create Configuration”).  
4. Create a new configuration and set **Login variation** to **WhatsApp Embedded Signup**.  
5. Permissions: ensure **WhatsApp accounts** (and any required business permissions) are selected.  
6. Save and copy the **Configuration ID** → `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID`.

If you don’t see “WhatsApp Embedded Signup” or “Facebook Login for Business”, your app may need the **WhatsApp** product added (Dashboard → Add Product → WhatsApp) and/or Tech Provider / Embedded Signup access.

---

## 3. `NEXT_PUBLIC_META_PARTNER_SOLUTION_ID`

This ID **does not come from the Meta dashboard**. It comes from **Twilio** after you join their WhatsApp Tech Provider program.

**How to get it:**  
1. Submit Twilio’s [WhatsApp Tech Provider program request form](https://www.twilio.com/whatsapp/tech-provider-program).  
2. Complete their steps (Meta app, Partner Solution acceptance, etc.).  
3. Twilio sends you a **Partner Solution request** to accept in your Meta app (e.g. in **WhatsApp → Partner Solutions** in the Meta app dashboard).  
4. After you **Accept**, the **Partner Solution ID** is shown (in Meta under that Partner Solution or in the email/ticket from Twilio).  
5. Use that value as `NEXT_PUBLIC_META_PARTNER_SOLUTION_ID`.

Until you have it, you can use **“Skip for now (test)”** in the create-app flow to create the app with only the provisioned number; you can complete Meta signup and link the sender later once Twilio gives you the Partner Solution ID.

---

## Example `.env.local`

**Local HTTPS:** Meta allows Facebook Login only on HTTPS. For local dev, run the frontend with HTTPS:

```bash
npm run dev:https
```

Then open **https://localhost:3001** (the HTTPS server runs on port 3001 so it doesn’t conflict with `npm run dev` on 3000). Accept the self-signed certificate warning in the browser once. The "Continue with Facebook" button will work on that URL.

---

Optional: only set these to override the built-in App ID and Config ID. Partner Solution ID has no default and must be set when you have it.

```env
# Meta Embedded Signup (optional overrides; App ID and Config ID have defaults in code)
# NEXT_PUBLIC_META_APP_ID=887322600586927
# NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID=2393474544425955
NEXT_PUBLIC_META_PARTNER_SOLUTION_ID=          # From provider after Tech Provider onboarding (required for full flow)
```
