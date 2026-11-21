/**
 * Noms des images stockées, sans dépendance serveur : utilisable dans un schéma Zod partagé
 * entre le formulaire (client) et la Server Action.
 * Forme : dossier connu + 32 hexadécimaux + extension connue.
 */
export const storedImageName = /^(covers|committee|avatars)\/[a-f0-9]{32}\.(jpg|png|webp)$/;

/** Dossiers d'images connus du stockage. */
export const imageFolders = ["covers", "committee", "avatars"] as const;
export type ImageFolder = (typeof imageFolders)[number];

export const isStoredImage = (name: string) => storedImageName.test(name);

/** Photos de profil : jamais servies par l'adresse publique `/uploads` (mineurs, vie privée). */
export const isPrivateImage = (name: string) => name.startsWith("avatars/");

/** Adresse publique d'une image stockée (couvertures, comité). */
export const uploadUrl = (name: string) => `/uploads/${name}`;

/** Adresse d'une photo de profil, servie aux seules personnes connectées. */
export const avatarUrl = (name: string) => `/api/member/photo/${name}`;
