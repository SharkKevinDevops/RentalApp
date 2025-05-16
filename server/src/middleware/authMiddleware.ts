// Importing necssary types from Express for type satefy in middleware
import { Request, Response, NextFunction } from "express";
// Importing the JwtPayload for decoding JWT tokens
import jwt, { JwtPayload } from "jsonwebtoken";

// Extending the JwtPayload interface to include custom properties from the token
interface DecodedToken extends JwtPayload {
  sub: string; // The subject (typically the user ID) from the JWT
  "custom:role": string; // Custom role property from the JWT
}

// Extending Express's Request interface globally to include a user property
// This allows middleware to attach user information to the request object
declare global{
  namespace Express {
    interface Request {
      user?: {
        id: string; // User ID from the JWT's sub claim
        role: string; // User role from the custom:role claim
      };
    }
  }
}

// Defiding the authMiddleware function, which takes an array of allowed roles as an argument
// Returns a middleware function that verifies JWT tokens and chechs role-based access.
export const authMiddleware = (allowedRoles: string[]) => {
  // Middleware function that handles authentication and authorization
  return (req: Request, res: Response, next: NextFunction): void => {
    // Extracting the token from the Authorization header (format: `Bearer <token>`)
    const token = req.headers.authorization?.split(" ")[1];

    // Check if toke exists; if not, return 401 Unauthorized
    if(!token) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    
    try {
      // Decode the JWT token to extract its payload (not verifying it signature here)
      const decoded = jwt.decode(token) as DecodedToken;
      // Extract the user role from the decoded token's custom:role claim (deafult to empty sting if undefined)
      const userRole = decoded["custom:role"] || "";
      // Attach user information (id and role) to the request object for downstream use
      req.user = {
        id: decoded.sub, // User ID from the sub claim
        role: userRole, // User role from the custom:role claim
      };

      // Check if the user's role is included in the allowedRoles array
      const hasAccess = allowedRoles.includes(userRole.toLowerCase());
      // If the user's role if not allowed, return 403 Forbidden
      if(!hasAccess) {
        res.status(403).json({ message: "Forbidden" });
        return;
      }
    }
    catch (err) {
      // Log any errors during the token and return 400 Bad Request
      console.error("Failed to decode token:", err);
      res.status(400).json({ message: "Invalid token"});
      return;
    }
    // If the token is valid and the user has access, proceed to the next middleware or route handler
    next(); 
  }
}