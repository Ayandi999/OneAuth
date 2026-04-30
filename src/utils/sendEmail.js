import nodemailer from 'nodemailer';

/**
 * Utility to send emails.
 * If SMTP_USER is not provided, it defaults to a fake Ethereal account for testing.
 */
const sendEmail = async ({ to, subject, text, html }) => {
    try {
        let transporter;

        // If no real credentials, use Ethereal (Fake SMTP)
        if (!process.env.SMTP_USER || process.env.SMTP_USER === 'your_user_id') {
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: "smtp.ethereal.email",
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            console.log("--- Using Ethereal Email (Testing Mode) ---");
        } else {
            // Use real credentials from .env
            transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });
        }

        const info = await transporter.sendMail({
            from: `"OneAuth Service" <no-reply@oneauth.com>`,
            to,
            subject,
            text,
            html,
        });

        // If using Ethereal, log the preview URL
        if (info.messageId && info.envelope) {
            const previewUrl = nodemailer.getTestMessageUrl(info);
            if (previewUrl) {
                console.log(`--- Email Sent! Preview URL: ${previewUrl} ---`);
            }
        }

        return info;
    } catch (error) {
        console.error("--- Error sending email ---");
        console.error(error);
        throw new Error("Email could not be sent");
    }
};

export default sendEmail;
