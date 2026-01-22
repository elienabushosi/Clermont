# Fix Email Template to Show Our 6-Digit Code

## The Problem
- Supabase's `{{ .Token }}` shows an 8-digit code (e.g., "10307872")
- Our backend generates a 6-digit code (e.g., "851039") and stores it in the database
- Validation checks against our 6-digit code, so Supabase's 8-digit token doesn't work

## The Solution
Update the email template to show our code from the URL, not Supabase's token.

## Steps to Fix

1. **Go to Supabase Dashboard**
   - Navigate to: **Authentication** → **Email Templates**
   - Click on **"Reset Password"** template

2. **Update the Email Subject:**
   ```
   Reset Your Password
   ```

3. **Update the Email Body (HTML):**
   
   **IMPORTANT:** Do NOT use `{{ .Token }}` - that's Supabase's 8-digit code. Instead, show instructions that the code is in the link:
   
   ```html
   <h2 style="color: #1f2937; font-size: 24px; margin-bottom: 20px;">Password Reset Request</h2>
   
   <p style="color: #374151; font-size: 16px; line-height: 1.6;">
     You requested to reset your password.
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
     <strong>Note:</strong> When you click the button above, you'll be taken to the password reset page and your 6-digit code will be automatically entered. You just need to enter your new password.
   </p>
   
   <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
     This code will expire in 15 minutes. If you didn't request this password reset, please ignore this email.
   </p>
   ```

4. **Save the template**

## How It Works Now

- Backend generates a **6-digit code** (e.g., `851039`)
- Code is stored in database
- Code is included in the URL: `/settings?resetCode=851039`
- Email is sent with the link containing our code
- When user clicks the link, the code is auto-filled from the URL
- User enters new password → password is reset with our 6-digit code

## Important
- **DO NOT** use `{{ .Token }}` in the template - that's Supabase's 8-digit code
- The code is in the URL (`{{ .ConfirmationURL }}`), and it will be auto-filled when the user clicks
