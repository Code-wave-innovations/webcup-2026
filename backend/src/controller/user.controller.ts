import { Response, Request } from "express";
import userModel from "../model/user.model";
import { uploadFile } from "../services/services";

const userController = {
    getAll: async (req: Request, res: Response) => {
        try {
            let result = await userModel.getAll();
            res.status(200).send(result)
        } catch (error: any) {
            console.log(error)
            res.status(500).send(error)
        }
    },
    getOne: async (req: Request, res: Response) => {
        try {
            let { id } = req.params
            let result = await userModel.getOne(parseInt(id));
            res.status(200).send(result)
        } catch (error: any) {
            console.log(error)
            res.status(500).send(error)
        }
    },
    create: async (req: Request, res: Response) => {
        let { 
            name,
				last_name,
				
        } = req.body
        // file
        
        try {
            
 
            let result = await userModel.create(
                name,
				last_name,
				
                // file
                
            )
            res.status(200).send(result)            
        }
        catch (error: any) {
            console.log(error)
            res.status(500).send(error)
        }
    },
    update: async (req: Request, res: Response) => {
        let { 
            name,
				last_name,
				
        } = req.body
        let id = parseInt(req.body.id)
        
        try {
            
 
            let result = await userModel.update(
                id,
                name,
				last_name,
				
                // file
                
            )
            res.status(200).send(result)            
        }
        catch (error: any) {
            console.log(error)
            res.status(500).send(error)
        }
    },
    delete: async (req: Request, res: Response) => {
        let id = parseInt(req.body.id)
        try {
            let result = await userModel.delete(
                id
            )
            res.status(200).send(result)            
        }
        catch (error: any) {
            console.log(error)
            res.status(500).send(error)
        }
    },
}

export default userController;