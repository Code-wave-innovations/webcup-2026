import bcrypt from "bcryptjs";

const ROUNDS = 10;
// Compared against when the email is unknown, so login timing does not reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer", ROUNDS);

export const hashPassword = (password: string) => bcrypt.hash(password, ROUNDS);

export const verifyPassword = async (password: string, hash: string | null | undefined) => {
  try {
    return await bcrypt.compare(password, hash ?? DUMMY_HASH);
  } catch {
    return false;
  }
};
