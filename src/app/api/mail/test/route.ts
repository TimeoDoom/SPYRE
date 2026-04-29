import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readMailSettings } from "@/lib/persist";

// Import the diagnose function indirectly by importing gmail module
// and calling the test through the regular gmail functions
export async function GET() {
  try {
    const session = await getSession();
    const mail = await readMailSettings(session);

    if (!mail?.address || !mail.appPassword) {
      return NextResponse.json(
        {
          success: false,
          message:
            "❌ Identifiants non configurés. Va à /settings et rentre ton email et App Password.",
        },
        { status: 400 },
      );
    }

    // Basic validation
    const email = mail.address;
    const appPassword = mail.appPassword;

    // Step 1: Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: `❌ Format email incorrect: "${email}"`,
        },
        { status: 400 },
      );
    }

    // Step 2: Email domain
    const emailDomain = email.split("@")[1].toLowerCase();
    if (emailDomain !== "gmail.com" && emailDomain !== "googlemail.com") {
      return NextResponse.json(
        {
          success: false,
          message: `⚠️ Email domain "${emailDomain}" n'est pas Gmail. Cet app fonctionne avec Gmail.`,
        },
        { status: 400 },
      );
    }

    // Step 3: App Password format
    if (!appPassword.includes(" ")) {
      return NextResponse.json(
        {
          success: false,
          message:
            "❌ App Password incorrect - Il ne contient pas d'espaces.\n" +
            "❌ Cela n'est PAS un App Password valide.\n" +
            "📍 Génère un App Password ici: https://myaccount.google.com/apppasswords\n" +
            "(Assure-toi d'avoir activé 2FA d'abord: https://myaccount.google.com/security)",
        },
        { status: 400 },
      );
    }

    // Step 4: App Password length
    const appPasswordNoSpaces = appPassword.replace(/\s/g, "");
    if (appPasswordNoSpaces.length < 16) {
      return NextResponse.json(
        {
          success: false,
          message:
            `❌ App Password trop court (${appPasswordNoSpaces.length} chars).\n` +
            "Un App Password Google fait généralement 16 caractères.\n" +
            "Vérifie que tu as bien copié tout le mot de passe.",
        },
        { status: 400 },
      );
    }

    // Step 5: Try connection
    const { ImapFlow } = await import("imapflow");

    const client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: {
        user: email,
        pass: appPassword,
      },
      logger: false,
    });

    console.log(`[test-mail] Testing IMAP connection for ${email}...`);

    try {
      await client.connect();
      console.log("[test-mail] ✓ Connection successful!");
      await client.logout();

      return NextResponse.json(
        {
          success: true,
          message:
            "✅ Connexion IMAP réussie! Ton compte Gmail est bien configuré.",
        },
        { status: 200 },
      );
    } catch (connectErr) {
      const err = connectErr as any;
      const errorMsg = err?.message || String(connectErr);

      console.error("[test-mail] Connection failed:", errorMsg);

      // Interpret error
      if (
        errorMsg.toLowerCase().includes("invalid") ||
        errorMsg.toLowerCase().includes("auth")
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "❌ Authentification échouée - Les identifiants sont incorrects.\n\n" +
              "Possible causes:\n" +
              "1. Email incorrect\n" +
              "2. App Password incorrect ou mal copié (avec les espaces?)\n" +
              "3. 2FA non activé sur le compte Google\n" +
              "4. App Password expiré ou supprimé\n\n" +
              "📍 Réinitialise:\n" +
              "1. Va à https://myaccount.google.com/security → Active 2FA\n" +
              "2. Va à https://myaccount.google.com/apppasswords\n" +
              "3. Génère un nouveau App Password\n" +
              "4. Copie-le (attention aux espaces!)\n" +
              "5. Rentre-le dans Settings",
          },
          { status: 401 },
        );
      } else if (errorMsg.includes("Command failed")) {
        return NextResponse.json(
          {
            success: false,
            message:
              "❌ Erreur IMAP 'Command failed' - Probablement un problème d'authentification.\n\n" +
              "Checklist:\n" +
              "☐ 1. L'email est correct et c'est un compte Gmail (@gmail.com)\n" +
              "☐ 2. 2FA est ACTIVÉ sur https://myaccount.google.com/security\n" +
              "☐ 3. Tu as généré un App Password (pas le mot de passe Gmail!)\n" +
              "     https://myaccount.google.com/apppasswords\n" +
              "☐ 4. Tu as bien copié le App Password complet (16 caractères avec espaces)\n" +
              "☐ 5. L'App Password n'a pas expiré\n\n" +
              "💡 Essaie de générer un nuevo App Password si rien ne marche.",
          },
          { status: 401 },
        );
      } else {
        return NextResponse.json(
          {
            success: false,
            message: `❌ Erreur de connexion: ${errorMsg}`,
          },
          { status: 500 },
        );
      }
    }
  } catch (error) {
    console.error("[test-mail] Unexpected error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "❌ Erreur serveur interne",
      },
      { status: 500 },
    );
  }
}
