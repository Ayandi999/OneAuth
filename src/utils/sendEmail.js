import nodemailer from 'nodemailer';

/**
 * Utility to send emails.
 * If SMTP_USER is not provided, it defaults to a fake Ethereal account for testing.
 */
const sendEmail = async ({ to, subject, text, html }) => {
    try {

        // Use Gmail SMTP service with credentials from .env
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const info = await transporter.sendMail({
            from: `"OneAuth Service" <${process.env.SMTP_USER}>`,
            to,
            subject,
            text,
            html,
        });

        console.log(`--- Email Sent successfully to ${to} ---`);

        return info;
    } catch (error) {
        console.error("--- Error sending email ---");
        console.error(error);
        throw new Error("Email could not be sent");
    }
};

export default sendEmail;
