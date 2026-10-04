const jwt = require("jsonwebtoken");
const fs = require("fs");

// Development fallback only: set JWT_SECRET in .env for any shared or deployed environment.
const DEV_SECRET = "iLoveYou";

let warnedAboutSecret = false;

const jwtSecret = () => {
  if (!process.env.JWT_SECRET && !warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn("⚠️  JWT_SECRET is not set, using the insecure development secret");
  }
  return process.env.JWT_SECRET || DEV_SECRET;
};

// `tv`: the account's token_version, so bumping it signs out every device (BO-05)
const generateToken = (id: number | undefined, email: string | undefined, role?: string, tokenVersion = 0) => {
  const token = jwt.sign(
    {
      id,
      email,
      role,
      tv: tokenVersion,
    },
    jwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
  return token;
};

// Throws when the token is invalid or expired.
const verifyToken = (token: string): { id: number; email?: string; role?: string; tv?: number; purpose?: string } => {
  return jwt.verify(token, jwtSecret());
};

const uploadFile = (chemin: any, fichier: any, add_name: any) => {
  return new Promise((resolve, reject) => {
    let uploadPath,
      current_time = new Date().getTime(),
      nom_img = "";

    if (!fichier) {
      reject("No files were uploaded.");
    }

    let fichier_name = fichier.name.split(".");
    let ext = fichier_name[fichier_name.length - 1];
    nom_img =
      add_name + "_codewave_" + current_time + String(Math.random()) + "." + ext;
    uploadPath = chemin + nom_img;

    fichier.mv(uploadPath, function (err: any) {
      if (err) reject(err);
      resolve(nom_img);
    });
  });
};

const deleteFile = (path: any) => {
  if (path) {
    let isDelete = false;
    fs.unlink(path, (err: any) => {
      if (err) throw err;
      isDelete = true;
    });
    return isDelete;
  } else {
    throw "Aucun chemin";
  }
};

export { generateToken, verifyToken, uploadFile, deleteFile, jwtSecret };
