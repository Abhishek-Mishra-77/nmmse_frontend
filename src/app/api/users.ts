import type { NextApiRequest, NextApiResponse } from "next";
import User from "../../models/User";
import sequelize from "../../lib/sequelize";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    await sequelize.authenticate();

    if (req.method === "GET") {
        const users = await User.findAll();
        return res.status(200).json(users);
    }

    if (req.method === "POST") {
        const { name, email, password, role } = req.body;
        try {
            const newUser = await User.create({ name, email, password, role });
            return res.status(201).json(newUser);
        } catch (error) {
            return res.status(400).json({ error: (error as Error).message });
        }
    }

    return res.status(405).json({ error: "Method Not Allowed" });
}
