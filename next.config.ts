import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Autorise les requêtes dev cross-origin (depuis ton téléphone sur le même
  // Wi-Fi). En prod ça n'a aucun effet, c'est purement dev.
  // Ajoute ton IP locale via la var d'env DEV_LAN_IP (ex: 192.168.1.42) dans
  // .env.local pour pouvoir ouvrir l'app depuis ton téléphone.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    ...(process.env.DEV_LAN_IP ? [process.env.DEV_LAN_IP] : []),
  ],
};

export default nextConfig;
