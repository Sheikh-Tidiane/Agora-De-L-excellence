# AUDIT-VISITEURS.md — Ce que voit chaque type de visiteur

> Audit du 14 novembre 2026, fait sur le code (relecture de chaque page publique et de chaque
> bouton d'action) avant correction. Colonnes : **V** visiteur non connecté · **M−** membre dont
> la carte n'est pas réglée · **M+** membre à jour · **R** responsable ou administrateur.
> ✅ cohérent · ❌ incohérent · — sans objet.

## État avant correction

| #   | Page / élément                                                                  | V   | M−  | M+  | R   | Constat                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------- | --- | --- | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Header, boutons de compte (toutes les pages)                                    | ✅  | ❌  | ❌  | ❌  | Avant que la session soit lue, tout le monde voit l'état « visiteur » (« Espace membre », « Adhérer »), puis il bascule : c'est le clignotement. Libellés à clarifier : « Espace membre » mène à la connexion |
| 2   | Header, responsable                                                             | —   | —   | —   | ❌  | Libellé « Administration » au lieu de « Mon espace »                                                                                                                                                          |
| 3   | Menu mobile, actions du bas                                                     | ✅  | ❌  | ❌  | ❌  | Même clignotement que le header                                                                                                                                                                               |
| 4   | Accueil, hero « Rejoindre le club »                                             | ✅  | ❌  | ❌  | ❌  | Appel à adhérer montré aux membres                                                                                                                                                                            |
| 5   | Accueil, lancement « Demander mon adhésion »                                    | ✅  | ❌  | ❌  | ❌  | Idem                                                                                                                                                                                                          |
| 6   | Accueil, section « Il reste une place. La vôtre. »                              | ✅  | ❌  | ❌  | ❌  | Section entière d'appel à adhérer                                                                                                                                                                             |
| 7   | À propos, « Demander mon adhésion »                                             | ✅  | ❌  | ❌  | ❌  | Défaut signalé                                                                                                                                                                                                |
| 8   | Activités, « Demander mon adhésion »                                            | ✅  | ❌  | ❌  | ❌  | Idem                                                                                                                                                                                                          |
| 9   | Agenda, encadré « Les membres s'inscrivent en un geste… Demander mon adhésion » | ✅  | ❌  | ❌  | ❌  | Idem                                                                                                                                                                                                          |
| 10  | Contact, « Vous voulez rejoindre le club ? »                                    | ✅  | ❌  | ❌  | ❌  | Idem                                                                                                                                                                                                          |
| 11  | Charte, « Demander mon adhésion »                                               | ✅  | ❌  | ❌  | ❌  | Idem ; un membre devrait lire qu'il l'a acceptée                                                                                                                                                              |
| 12  | Pied de page, « Adhérer » et « Espace membre »                                  | ✅  | ❌  | ❌  | ❌  | Idem ; « Espace membre » mène à la connexion                                                                                                                                                                  |
| 13  | `/membership`                                                                   | ✅  | ❌  | ❌  | ❌  | Formulaire complet proposé à un membre (le serveur refuse ensuite : « déjà un compte »)                                                                                                                       |
| 14  | `/login`                                                                        | ✅  | ✅  | ✅  | ✅  | Redirection vers son espace (corrigé le 14/11)                                                                                                                                                                |
| 15  | Fiche d'une rencontre, inscription                                              | ✅  | ✅  | ✅  | ✅  | Membre : inscription en un clic, « Vous êtes inscrit » ; pas de formulaire invité                                                                                                                             |
| 16  | Fiche d'une rencontre, « Connectez-vous »                                       | ❌  | —   | —   | —   | Après connexion, on arrive dans `/member` et non sur la rencontre qu'on voulait                                                                                                                               |
| 17  | Lien de visio                                                                   | ✅  | ✅  | ✅  | ✅  | Visible des seuls inscrits                                                                                                                                                                                    |
| 18  | `/member`, carte de membre                                                      | —   | ❌  | ✅  | —   | Rien n'indique au membre que sa carte reste à régler (ni le montant ni comment)                                                                                                                               |
| 19  | Lien vers l'administration                                                      | —   | —   | —   | ✅  | Sur `/member` et à la connexion ; à garder dans le header                                                                                                                                                     |

## Corrections

1–3 : header et menu lus côté serveur avec `use cache: private` (gardé en mémoire par le navigateur : les
navigations sont instantanées), repli **invisible** à la même place au lieu d'un faux état
« visiteur » ; libellés « Se connecter » et « Adhérer » / « Mon espace » et « Se déconnecter » ;
« Mon espace » mène à l'administration pour un responsable. 4–13 : appels à adhérer réservés aux
visiteurs, remplacés pour un membre par « Mon espace » ou par rien ; `/membership` montre à un
membre qu'il l'est déjà ; la charte lui rappelle qu'il l'a acceptée. 16 : « Connectez-vous »
ramène à la rencontre. 18 : `/member` indique l'état de la carte et comment la régler.

Vérification : `e2e/visiteurs.spec.ts`, un parcours par type de visiteur.
