# Pixinium authentication email

In Supabase Authentication's Email Templates, open **Confirm signup**:

- Subject: `Confirm your Pixinium email`
- Body: paste the complete contents of `confirm-signup.html`.
- Site URL: set the application's real origin in Auth URL Configuration (no
  trailing slash). The template targets the existing `/auth/confirm` handler.

The template uses inline styles, presentation tables, system fonts and a text
wordmark so it needs no external fonts, scripts, images or asset hosting. It
includes a fallback link and deliberately makes no fixed expiry promise.
It is for signup confirmation only, not password reset or email change.

Changing the template does not change the sending address. For a branded sender,
configure custom SMTP in Supabase Authentication:

1. Choose an SMTP provider such as Resend, Postmark or Amazon SES.
2. Verify a domain you own with that provider and add its DNS records (SPF/DKIM;
   configure DMARC as appropriate).
3. Set Sender name to `Pixinium` and Sender email to a verified address on that
   domain, such as `accounts@your-domain.com` (replace this example).
4. Enter the provider's SMTP host, port, username and password in Supabase's
   SMTP settings. Do not put SMTP credentials in browser code or templates.
5. Disable provider link tracking for authentication email to avoid rewriting
   confirmation URLs. Preview and test delivery to an account you control.

This local template has not been uploaded or sent. Review rendering in the
Supabase preview and the mail clients you support before production use.

References:
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/auth-smtp
