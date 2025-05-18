/**
 * Express.js API endpoints for managing properties in a real estate application.
 * Provides functionality to retrieve properties (filtered by various criteria including geospatial proximity),
 * fetch a single property with standardized coordinates, and create new properties with S3 photo uploads
 * and geocoded locations. Uses Prisma with PostgreSQL/PostGIS for database operations and AWS S3 for file storage.
 * 
 * @module propertyController
 * @requires express
 * @requires @prisma/client
 * @requires @terraformer/wkt
 * @requires @aws-sdk/client-s3
 * @requires @aws-sdk/lib-storage
 * @requires axios
 */


import { Request, Response } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { wktToGeoJSON } from "@terraformer/wkt";
import { S3Client } from "@aws-sdk/client-s3";
import { Location } from "@prisma/client";
import { Upload } from "@aws-sdk/lib-storage";
import axios from "axios";
const prisma = new PrismaClient();
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
})
export const getProperties = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
        favoriteIds,
        priceMin,
        priceMax,
        beds,
        baths,
        propertyType,
        squareFeetMin,
        squareFeetMax,
        amenities,
        availableFrom,
        latitude,
        longitude,
    } = req.query;


    // with a where condition 
    // just set up the query with the params that are not undefined
    let whereConditions: Prisma.Sql[] = [];

    if (favoriteIds) {
      const favoriteIdsArray = (favoriteIds as string).split(",").map(Number);
      whereConditions.push(
        Prisma.sql`id IN (${Prisma.join(favoriteIdsArray)})` // search for the ids of the properties
      )
    }

    if (priceMin) {
      whereConditions.push(
        Prisma.sql`pricePerMonth >= ${Number(priceMin)}` // search for the price of the properties
      )
    }

    if (priceMax) {
      whereConditions.push(
        Prisma.sql`pricePerMonth <= ${Number(priceMax)}` // search for the price of the properties
      )
    }

    if (beds && beds !== "any") {
      whereConditions.push(
        Prisma.sql`p.beds >= ${Number(beds)}` // search for the beds of the properties
      )
    }

    if (baths && baths !== "any") {
      whereConditions.push(
        Prisma.sql`p.baths >= ${Number(baths)}` // search for the beds of the properties
      )
    }

    if (squareFeetMin) {
      whereConditions.push(
        Prisma.sql`p."squareFeet" >= ${Number(squareFeetMin)}` // search for the square feet of the properties
      )
    }

    if (squareFeetMax) {
      whereConditions.push(
        Prisma.sql`p."squareFeet" <= ${Number(squareFeetMax)}` // search for the square feet of the properties
      )
    }

    if (propertyType && propertyType !== "any") {
      whereConditions.push(
        Prisma.sql`p."propertyType" = ${propertyType}::"PropertyType"` // search for the property type of the properties
      )
    }

    if (amenities && amenities !== "any") {
      const amenitiesArray = (amenities as string).split(",");
      whereConditions.push(
        Prisma.sql`p.amenities @> ${amenitiesArray}` // search for the amenities of the properties
      )
    }

    if (availableFrom) {
      const availableFromDate = typeof availableFrom === "string" ? availableFrom : null;
      if (availableFromDate) {
        const date = new Date(availableFromDate);
        if (!isNaN(date.getTime())) {
          whereConditions.push(
            Prisma.sql`EXISTS (
              SELECT 1 FROM "Lease" l
              WHERE l."propertyId" = p.id
              AND l."startDate" <= ${date.toISOString()}
              )`
          );
        }
      }

    }

    if (latitude && longitude) {
      const lat = parseFloat(latitude as string);   // values are cast to string and converted to floating-point numbers
      const lon = parseFloat(longitude as string);
      const rediusInKilometers = 1000; 
      const degrees = rediusInKilometers / 111.32; // 1 degree is approximately 111.32 km

      whereConditions.push(
        Prisma.sql`ST_DWithin(
        l.coordinates::geometry,
        ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326),
        ${degrees})`
      );
    }


    // Construct the SQL query
    // Use Prisma.sql to safely construct the SQL query
    const completeQuery = Prisma.sql`
        SELECT p.*,
        json_build_object(
          'id', l.id,
          'address', l.address,
          'city', l.city,
          'state', l.state,
          'country', l.country,
          'postalCode', l."postalCode",
          'coordinates', json_build_object(
            'longitude', ST_X(l."coordinates"::geometry),
            'latitude', ST_Y(l."coordinates"::geometry)
          ) as location
        FROM "Property" p
        JOIN "Location" l ON p."locationId" = l.id
        ${
            whereConditions.length > 0
              ? Prisma.sql`WHERE ${Prisma.join(whereConditions, " AND ")}`
              : Prisma.empty
        }
        ;`

        const properties = await prisma.$queryRaw(completeQuery);  // Execute the query

        res.json(properties);  // Send the result as JSON

  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving properties: ${error.message}` });
  }
};

export const getProperty = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const property = await prisma.property.findUnique({
            where: { id: Number(id) },
            include: {
                location: true,
            },
        });


        if (property) {
          const coordinates: { coordinates: string }[] =
            await prisma.$queryRaw`SELECT ST_asText(coordinates) as coordinates FROM "Location" WHERE id = ${property.location.id}`;


            const geoJSON: any = wktToGeoJSON(coordinates[0]?.coordinates || "");
            const longitude = geoJSON.coordinates[0];
            const latitude = geoJSON.coordinates[1];

            const propertyWithCoordinates = {
                ...property,
                location: {
                ...property.location,
                coordinates: {
                    longitude,
                    latitude,
                },
                },
            };
            res.json(propertyWithCoordinates);


            }
    }
    catch (error: any) {
        res
        .status(500)
        .json({ message: `Error retrieving property: ${error.message}` });
  }
}

export const createProperty = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const files = req.files as Express.Multer.File[]; // Cast the files to the correct type
        const {
            address,
            city,
            state,
            country,
            postalCode,
            managerCognitoId,
            ...propertyData
        } = req.body;

        const photoUrls = await Promise.all(
      files.map(async (file) => {
        const uploadParams = {
          Bucket: process.env.S3_BUCKET_NAME!,
          Key: `properties/${Date.now()}-${file.originalname}`,
          Body: file.buffer,
          ContentType: file.mimetype,
        };

        const uploadResult = await new Upload({
          client: s3Client,
          params: uploadParams,
        }).done();

        return uploadResult.Location;
      })
    );

    const geocodingUrl = `https://nominatim.openstreetmap.org/search?${new URLSearchParams(
      {
        street: address,
        city,
        country,
        postalcode: postalCode,
        format: "json",
        limit: "1",
      }
    ).toString()}`;
    const geocodingResponse = await axios.get(geocodingUrl, {
      headers: {
        "User-Agent": "RealEstateApp (justsomedummyemail@gmail.com",
      },
    });
    const [longitude, latitude] =
      geocodingResponse.data[0]?.lon && geocodingResponse.data[0]?.lat
        ? [
            parseFloat(geocodingResponse.data[0]?.lon),
            parseFloat(geocodingResponse.data[0]?.lat),
          ]
        : [0, 0];

    // create location
    const [location] = await prisma.$queryRaw<Location[]>`
      INSERT INTO "Location" (address, city, state, country, "postalCode", coordinates)
      VALUES (${address}, ${city}, ${state}, ${country}, ${postalCode}, ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326))
      RETURNING id, address, city, state, country, "postalCode", ST_AsText(coordinates) as coordinates;
    `;

    // create property
    const newProperty = await prisma.property.create({
      data: {
        ...propertyData,
        photoUrls,
        locationId: location.id,
        managerCognitoId,
        amenities:
          typeof propertyData.amenities === "string"
            ? propertyData.amenities.split(",")
            : [],
        highlights:
          typeof propertyData.highlights === "string"
            ? propertyData.highlights.split(",")
            : [],
        isPetsAllowed: propertyData.isPetsAllowed === "true",
        isParkingIncluded: propertyData.isParkingIncluded === "true",
        pricePerMonth: parseFloat(propertyData.pricePerMonth),
        securityDeposit: parseFloat(propertyData.securityDeposit),
        applicationFee: parseFloat(propertyData.applicationFee),
        beds: parseInt(propertyData.beds),
        baths: parseFloat(propertyData.baths),
        squareFeet: parseInt(propertyData.squareFeet),
      },
      include: {
        location: true,
        manager: true,
      },
    });

    res.status(201).json(newProperty);


    }
    catch (error: any) {
        res
        .status(500)
        .json({ message: `Error creating property: ${error.message}` });
    }
}
