# Update Supabase Email Template to Show Reset Code

## IMPORTANT: Code Length Issue Fixed

The form now accepts codes up to 10 characters. Our backend generates a **6-digit code** that will be in the URL.

## Quick Steps

1. **Go to Supabase Dashboard**
   - Navigate to: **Authentication** → **Email Templates**
   - Click on **"Reset Password"** template

2. **Update the Email Subject:**
   ```
   Reset Your Password
   ```

3. **Update the Email Body (HTML):**
   
   **IMPORTANT:** The code is in the URL as `resetCode=XXXXXX`. Since Supabase templates can't easily extract it, we'll show instructions and the link contains the code:
   
   ```html
   <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 20px;">Password Reset Request</h2>
   
   <p style="color: #374151; font-size: 16px; line-height: 1.6;">
     You requested to reset your password. Your reset code is in the link below.
   </p>
   
   <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 20px 0;">
     <strong>Click the button below to go to the reset page. Your 6-digit code will be automatically filled in.</strong>
   </p>
   
   <div style="text-align: center; margin: 30px 0;">
     <a href="{{ .ConfirmationURL }}" 
        style="background-color: #37322F; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px;">
       Reset Password
     </a>
   </div>
   
   <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 20px; padding: 15px; background: #f9fafb; border-left: 4px solid #3b82f6;">
     <strong>Note:</strong> When you click the button above, you'll be taken to the password reset page and your code will be automatically entered. You just need to enter your new password.
   </p>
   
   <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
     This code will expire in 15 minutes. If you didn't request this password reset, please ignore this email.
   </p>
   ```

4. **Save the template**

## How It Works

- Backend generates a **6-digit code** (e.g., `123456`)
- Code is stored in database and included in the URL: `/settings?resetCode=123456`
- When user clicks the link, the code is automatically filled in the form
- User just needs to enter their new password

## Alternative: Show Code Directly

If you want the code visible in the email (not just in the URL), we need to use a custom email service (Resend, SendGrid, etc.) or Supabase Edge Functions. The current Supabase email template system can't easily extract our custom code from the URL.
