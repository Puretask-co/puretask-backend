# ⚡ Railway Quick Start - 5 Minutes

## 🎯 Right Now: What You Need to Do

You're looking at Railway with:
- ✅ Postgres (online)
- ❌ Backend (offline)

**Goal**: Get your backend online in 5 steps.

---

## 🚀 5-Minute Setup

### 1️⃣ Click "puretask-backend" Service
- Click the card that says "Service is offline"
- This opens the service page

### 2️⃣ Set DATABASE_URL
- In the service page, go to **"Variables"** tab
- Click **"+ New Variable"**
- **Name**: `DATABASE_URL`
- **Value**: Copy from Postgres service
  - Click **Postgres** service → **"Variables"** tab → Copy `DATABASE_URL`
- Click **"Save"**

### 3️⃣ Set JWT_SECRET
- Still in Variables tab
- Click **"+ New Variable"**
- **Name**: `JWT_SECRET`
- **Value**: Run this in PowerShell:
  ```powershell
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Copy the output and paste as value
- Click **"Save"**

### 4️⃣ Deploy
- Go back to service page
- Click **"Deploy"** or **"Redeploy"** button
- Wait 2-5 minutes

### 5️⃣ Test
- After deployment, click **"Settings"** tab
- Click **"Generate Domain"**
- Copy the URL
- Test: `curl https://your-url.railway.app/health`

---

## ✅ Done!

Your backend should now be online! 🎉

**Next**: Add remaining variables (STRIPE_SECRET_KEY, etc.) - see `docs/RAILWAY_BEGINNERS_GUIDE.md`

---

## 🆘 Stuck?

**Backend still offline?**
- Check "Logs" tab for errors
- Make sure `DATABASE_URL` is set correctly
- Try "Redeploy" again

**Need more help?**
- See `docs/RAILWAY_BEGINNERS_GUIDE.md` for detailed steps

