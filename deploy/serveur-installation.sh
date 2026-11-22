#!/usr/bin/env bash
# Installation et sécurisation du VPS (Ubuntu 24.04 LTS), À LANCER UNE FOIS, en root (sudo).
# Relançable sans risque : chaque étape vérifie ce qui est déjà fait.
#
#   sudo bash serveur-installation.sh
#
# Fait, dans l'ordre (docs/DEPLOIEMENT.md, « Sécuriser le serveur ») :
#   1. mises à jour, fuseau UTC (= heure de Dakar) ;
#   2. utilisateur `agora` (sudo, docker), avec les clés SSH du compte qui lance le script ;
#   3. SSH par clé seulement, root interdit, seul `agora` autorisé — SANS couper la session en cours ;
#   4. pare-feu ufw : 22, 80, 443 (et 443/udp pour HTTP/3), tout le reste fermé ;
#   5. fail2ban sur SSH ;
#   6. mises à jour de sécurité automatiques, redémarrage si nécessaire à 04:30 UTC ;
#   7. 2 Go d'échange (swap), journaux limités ;
#   8. Docker (dépôt officiel), journaux des conteneurs en rotation ;
#   9. dossiers /srv/agora, /etc/agora, /var/backups/agora ; age et rclone.
#
# Ne fait PAS : cloner le dépôt, écrire les secrets, lancer le site (étapes suivantes du guide).
set -euo pipefail

ADMIN_USER="${ADMIN_USER:-agora}"
SSH_SOURCE_USER="${SUDO_USER:-root}"
step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

[ "$(id -u)" = 0 ] || { echo "À lancer avec sudo." >&2; exit 1; }
. /etc/os-release
[ "$ID" = ubuntu ] || { echo "Prévu pour Ubuntu (trouvé : $ID)." >&2; exit 1; }

step "1. Mises à jour et fuseau horaire"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get -y -q full-upgrade
apt-get -y -q install ufw fail2ban unattended-upgrades apt-listchanges ca-certificates curl gnupg age rclone git
timedatectl set-timezone UTC

step "2. Utilisateur $ADMIN_USER"
if ! id "$ADMIN_USER" > /dev/null 2>&1; then
  adduser --disabled-password --gecos "Administration L'Agora" "$ADMIN_USER"
fi
usermod -aG sudo "$ADMIN_USER"
# sudo sans mot de passe : le compte n'a pas de mot de passe (connexion par clé seulement).
echo "$ADMIN_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/90-$ADMIN_USER"
chmod 440 "/etc/sudoers.d/90-$ADMIN_USER"
visudo -cq
SRC_KEYS="$(getent passwd "$SSH_SOURCE_USER" | cut -d: -f6)/.ssh/authorized_keys"
DST_DIR="/home/$ADMIN_USER/.ssh"
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" "$DST_DIR"
touch "$DST_DIR/authorized_keys"
if [ -s "$SRC_KEYS" ]; then
  # Ajoute les clés manquantes sans dupliquer.
  sort -u "$SRC_KEYS" "$DST_DIR/authorized_keys" -o "$DST_DIR/authorized_keys"
fi
chown "$ADMIN_USER:$ADMIN_USER" "$DST_DIR/authorized_keys"
chmod 600 "$DST_DIR/authorized_keys"
grep -qE '^(ssh-|ecdsa-)' "$DST_DIR/authorized_keys" || {
  echo "ARRÊT : aucune clé SSH pour $ADMIN_USER ($DST_DIR/authorized_keys est vide)." >&2
  echo "Ajoutez-y une clé publique avant de relancer : sinon, plus personne ne pourrait se connecter." >&2
  exit 1
}

step "3. SSH par clé seulement"
# Fichier en 10- : lu AVANT 50-cloud-init.conf (qui contient souvent PasswordAuthentication yes),
# et la première valeur lue l'emporte.
cat > /etc/ssh/sshd_config.d/10-agora.conf <<EOF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
AllowUsers $ADMIN_USER
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
EOF
sshd -t
# reload : la session en cours n'est pas coupée.
systemctl reload ssh

step "4. Pare-feu"
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw limit 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable
ufw status verbose

step "5. fail2ban"
cat > /etc/fail2ban/jail.d/agora.local <<'EOF'
[sshd]
enabled = true
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
bantime.increment = true
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

step "6. Mises à jour de sécurité automatiques"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52agora <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
systemctl enable --now unattended-upgrades

step "7. Échange (swap) et journaux"
if ! swapon --show | grep -q /swapfile; then
  [ -f /swapfile ] || { fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile > /dev/null; }
  if swapon /swapfile; then
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  else
    echo "ATTENTION : échange (swap) impossible sur ce système de fichiers ; on continue sans." >&2
    rm -f /swapfile
  fi
fi
echo 'vm.swappiness=10' > /etc/sysctl.d/90-agora.conf
sysctl -q --system
install -d /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=500M\nMaxRetentionSec=1month\n' > /etc/systemd/journald.conf.d/agora.conf
systemctl restart systemd-journald

step "8. Docker"
if ! command -v docker > /dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get -y -q install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Journaux en rotation ; pas de « userland-proxy » : Caddy voit la vraie adresse des visiteurs.
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "5" },
  "userland-proxy": false,
  "live-restore": true
}
EOF
systemctl enable docker
systemctl restart docker
usermod -aG docker "$ADMIN_USER"

step "9. Dossiers"
install -d -m 755 -o "$ADMIN_USER" -g "$ADMIN_USER" /srv/agora
install -d -m 750 -o root -g "$ADMIN_USER" /etc/agora
install -d -m 700 -o "$ADMIN_USER" -g "$ADMIN_USER" /var/backups/agora

cat <<EOF

Installation terminée.

AVANT DE FERMER CETTE SESSION, dans un SECOND terminal :
    ssh $ADMIN_USER@<adresse-du-serveur>
Si la connexion réussit, cette session peut être fermée. Sinon, corrigez depuis celle-ci
(ou depuis la console KVM de l'espace client OVHcloud).
EOF
