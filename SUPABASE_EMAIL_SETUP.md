# Supabase Email Configuration for Password Reset Codes

## Overview
This guide walks you through configuring Supabase to send password reset codes via email.

## Current Implementation
- Backend generates a 6-digit code and stores it in the `password_reset_codes` table
- Code is included in the redirect URL: `/settings?resetCode=123456`
- Supabase's `resetPasswordForEmail()` sends the email

## Recommended Approach: Customize Email Template

Since we're using our own code system, the best approach is to customize Supabase's email template to clearly show the code from the URL.

### Steps:

1. **Go to Supabase Dashboard**
   - Navigate to: **Authentication** → **Email Templates**
   - Click on **"Reset Password"** template

2. **Update the Email Subject**
   ```
   Reset Your Password - Code Inside
   ```

3. **Update the Email Body**
   
   Customize the template to emphasize the code in the URL:
   
   ```html
   <h2>Password Reset Request</h2>
   <p>You requested to reset your password.</p>
   
   <p><strong>Click the link below to reset your password. Your code will be automatically filled in.</strong></p>
   
   <div style="text-align: center; margin: 30px 0;">
     <a href="{{ .ConfirmationURL }}" 
        style="background-color: #37322F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
       Reset Password
     </a>
   </div>
   
   <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
     <strong>Note:</strong> The link above contains your password reset code. When you click it, you'll be taken to the settings page with the code pre-filled.
   </p>
   
   <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
     This code will expire in 15 minutes. If you didn't request this, please ignore this email.
   </p>
   ```

4. **How It Works**
   - User clicks "Send Password Reset Code" on settings page
   - Backend generates code (e.g., `123456`) and stores it
   - Email is sent with link: `https://yoursite.com/settings?resetCode=123456`
   - User clicks link → taken to settings page → code is auto-filled from URL
   - User enters new password → password is reset

### Alternative: Show Code Directly in Email

If you want to display the code directly in the email (not just in the URL), you'll need to use Supabase Edge Functions (see Option 2 below).

## Option 2: Use Supabase Edge Functions (More Control)

For full control over the email content with our custom code, use Supabase Edge Functions:

### Steps:

1. **Create an Edge Function**
   ```bash
   supabase functions new send-password-reset-email
   ```

2. **Install email service** (e.g., Resend, SendGrid, or use Supabase's email API)

3. **Update Backend to Call Edge Function**
   Instead of `resetPasswordForEmail()`, call your Edge Function with the code.

### Example Edge Function:
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { email, code } = await req.json()
  
  // Send email with custom code using your email service
  // ...
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  })
})
```

## Option 3: Use Supabase Send Email Hook (Advanced)

Configure a webhook that intercepts Supabase's email sending and customizes it:

1. Go to **Database** → **Webhooks**
2. Create a webhook for `auth.users` table
3. Customize the email in the webhook

## Recommended Approach for V1

**Use Option 1** - Customize the email template:
- Quick to set up
- Uses Supabase's built-in email infrastructure
- Code is accessible via the redirect URL
- Users can click the link and the code will be pre-filled

The user will receive an email with:
- Supabase's token (6-digit code) - can be used if you want
- A link that contains your custom code in the URL
- When they click the link, they're taken to `/settings?resetCode=123456` where the code is automatically filled

## Testing

1. Request a password reset from the settings page
2. Check your email (or Supabase logs if using local development)
3. Verify the code appears in the email or URL
4. Test the reset flow

## Production Considerations

- Remove the dev mode code return in the API response
- Ensure email delivery is reliable (check Supabase email settings)
- Consider rate limiting for password reset requests
- Monitor failed email deliveries
