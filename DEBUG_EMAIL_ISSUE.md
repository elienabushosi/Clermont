# Debugging Password Reset Email Issue

## Quick Checks

### 1. Check Backend Logs
When you click "Send Password Reset Code", check your backend terminal. You should see:
- `Attempting to send password reset email to: [email]`
- `Reset code: [6-digit code]`
- Any error messages

### 2. Check Browser Console
Open DevTools (F12) → Console tab. Look for:
- Error messages
- Warnings about email delivery
- The code should be displayed in a blue box if email fails

### 3. Verify User Exists in Supabase Auth

**The most likely issue:** `resetPasswordForEmail()` requires the user to exist in Supabase Auth.

**Check this:**
1. Go to Supabase Dashboard
2. Navigate to **Authentication** → **Users**
3. Search for your email address
4. If the user doesn't exist, that's the problem!

**Why this happens:**
- Your app uses custom authentication (custom `users` table)
- Users might not be created in Supabase Auth during signup
- `resetPasswordForEmail()` only works for users in Supabase Auth

### 4. Check Supabase Email Settings

1. Go to **Authentication** → **Settings**
2. Verify:
   - Email provider is configured (or using Supabase's default)
   - "Enable email confirmations" is enabled
   - SMTP settings are correct (if using custom SMTP)

### 5. Check Email Spam Folder

Sometimes emails go to spam. Check your spam/junk folder.

## Solutions

### Solution 1: Ensure User Exists in Supabase Auth (Recommended)

The login endpoint should create users in Supabase Auth if they don't exist. Let's verify this is working:

1. Try logging in with your account
2. Check if a user appears in Supabase Auth → Users
3. If not, the login flow needs to be fixed

### Solution 2: Use Alternative Email Sending

If users don't exist in Supabase Auth, we can:
1. Use a third-party email service (Resend, SendGrid, etc.)
2. Use Supabase Edge Functions to send emails
3. Use Supabase's Management API to send custom emails

### Solution 3: Create User in Supabase Auth During Password Reset

We can modify the password reset endpoint to:
1. Check if user exists in Supabase Auth
2. If not, create them (with a temporary password)
3. Then send the reset email

## Immediate Workaround

For now, the code is being generated and stored. In development mode, you should see the code displayed on the screen. You can:
1. Use that code directly to reset your password
2. The code is valid for 15 minutes
3. Check the database: `SELECT * FROM password_reset_codes WHERE "IdUser" = '[your-user-id]'`

## Next Steps

1. **Check backend logs** - What error message do you see?
2. **Check Supabase Auth Users** - Does your user exist there?
3. **Share the error** - Let me know what you find and I'll help fix it!
