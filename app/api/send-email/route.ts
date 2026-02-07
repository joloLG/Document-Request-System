import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const { to, subject, html } = await request.json();

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, html" },
        { status: 400 }
      );
    }

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    // specific check to allow development without actual email sending if vars are missing
    if (!host || !user || !pass) {
      console.warn("SMTP environment variables not set. Email not sent.");
      return NextResponse.json({
        success: true,
        message: "Email simulated (SMTP config missing)",
      });
    }

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: Number(port) === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"SorSU Registrar" <registrar@sorsu.edu.ph>',
      to,
      subject,
      html,
    });

    return NextResponse.json({ success: true, message: "Email sent" });
  } catch (error: unknown) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
