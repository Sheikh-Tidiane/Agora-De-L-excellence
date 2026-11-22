// Environnement minimal des tests unitaires : aucune base ni serveur n'est nécessaire.
process.env.APP_URL ??= "http://localhost:3000";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5433/test";
process.env.BETTER_AUTH_SECRET ??= "secret-de-test-uniquement-0123456789abcdef";
process.env.MAIL_FROM ??= "test@agora.localhost";
