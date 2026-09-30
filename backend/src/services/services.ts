const jwt = require("jsonwebtoken");
const fs = require("fs");
const SECRET = "iLoveYou";

const generateToken = (id: number | undefined, email: string | undefined) => {
  const token = jwt.sign(
    {
      id,
      email,
    },
    SECRET,
    {
      expiresIn: "365d",
    }
  );
  return token;
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

export { generateToken, uploadFile, deleteFile };
