import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { REPLCommand } from 'repl';

const prisma = new PrismaClient();


// this function to retrives applications based on user type
// filters applications using different where clause depending on user type
// include related like property, location, manager, tenant, information
// calculates the next payment date for each application that has an asssociated lease
// returns formatted application data with all necessary related information
export const listApplications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId, userType } = req.query;

    let whereClause = {};


    // Check user type
    if (userId && userType) {
      if (userType === "tenant") {
        whereClause = { 
          tenantCognitoId: String(userId) 
        };
      } else if (userType === "manager") {
        whereClause = {
          property: {
            managerCognitoId: String(userId),
          },
        };
      }
    }

    // define the application
    const applications = await prisma.application.findMany({
      where: whereClause,
      include: {
        property: {
          include: {
            location: true,
            manager: true,
          },
        },
        tenant: true,
      },
    });

    // function to caculate the next payment
    function calculateNextPaymentDate(startDate: Date): Date {
      const today = new Date();
      const nextPaymentDate = new Date(startDate);
      while (nextPaymentDate <= today) {
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      }
      return nextPaymentDate;
    }


    // define the format of applications
    const formattedApplications = await Promise.all(
      applications.map(async (app) => {
        const lease = await prisma.lease.findFirst({
          where: {
            tenant: {
              cognitoId: app.tenantCognitoId,
            },
            propertyId: app.propertyId,
          },
          orderBy: { startDate: "desc" },
        });

        return {
          ...app,
          property: {
            ...app.property,
            address: app.property.location.address,
          },
          manager: app.property.manager,
          lease: lease
            ? {
                ...lease,
                nextPaymentDate: calculateNextPaymentDate(lease.startDate),
              }
            : null,
        };
      })
    );

    res.json(formattedApplications);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error retrieving applications: ${error.message}` });
  }
};

// To create new rental application with tenant and property information
export const createApplication = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // grab all the informations from request body
    const {
      applicationDate,
      status,
      propertyId,
      tenantCognitoId,
      name,
      email,
      phoneNumber,
      message
    } = req.body;

    // grap the property from prisma
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { pricePerMonth: true, securityDeposit: true }
    });

    // Check the property
    if(!property) {
      res.status(404).json({ message: "Property not found." });
      return;
    }

    const newApplication = await prisma.$transaction(async (prisma) => {
      // create new lease
      const lease = await prisma.lease.create({
        data: {
          startDate: new Date(), // Today
          endDate: new Date(
            new Date().setFullYear(new Date().getFullYear() + 1)
          ), // 1 year from today
          rent: property.pricePerMonth,
          deposit: property.securityDeposit,
          property: {
            connect: { id: propertyId },
          },
          tenant: {
            connect: { id: tenantCognitoId }
          }
        },

      });

      
    const application = await prisma.application.create({
      data: {
        applicationDate: new Date(applicationDate),
        status,
        name,
        email,
        phoneNumber,
        message,
        property: {
          connect: { id: propertyId },
        },
        tenant: {
          connect: { id: tenantCognitoId },
        },
        lease: {
          connect: { id: lease.id },
        },
      },
      include: {
        property: true,
        tenant: true,
        lease: true,
      },
    });
    return application;
    });

    res.status(201).json(newApplication);
  }
  catch (error: any) {
    res
      .status(500)
      .json({ message: `Error creating application: ${error.message}` });
  }
};


// to approving or rejecting the application for the manager
export const updateApplicationStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {

    // gets informations from request
    const { id } = req.params;
    const { status } = req.body; // gets status from body
    console.log("status:", status);

    const application = await prisma.application.findUnique({
      where: { id: Number(id) }, // fecth the application from the databse
      include: {
        property: true,
        tenant: true,
      },
    });

    // handles application not found
    if (!application) {
      res.status(404).json({ message: "Application not found." });
      return;
    }

    // Special handle for "Approving" status
    if (status === "Approved") {

      // create new lease gets created when the status is approved
      const newLease = await prisma.lease.create({
        data: {
          startDate: new Date(), // current date
          endDate: new Date(      // set to one year from now
            new Date().setFullYear(new Date().getFullYear() + 1)
          ),
          rent: application.property.pricePerMonth,      // Rent and deposit values taken from the property
          deposit: application.property.securityDeposit,
          propertyId: application.propertyId,           // Link to property and tenant
          tenantCognitoId: application.tenantCognitoId,
        },
      });

      // Update the property to connect the tenant
      await prisma.property.update({
        where: { id: application.propertyId },
        data: {
          tenants: {
            connect: { cognitoId: application.tenantCognitoId },
          },
        },
      });

      // Update the application with the new status and links it to the new lease
      await prisma.application.update({
        where: { id: Number(id) },
        data: { status, leaseId: newLease.id },
        include: {
          property: true,
          tenant: true,
          lease: true,
        },
      });
    } else {
      // Update the application status (for both "Denied" and other statuses)
      await prisma.application.update({
        where: { id: Number(id) },
        data: { status },
      });
    }

    // Respond with the updated application details
    const updatedApplication = await prisma.application.findUnique({
      where: { id: Number(id) },
      include: {
        property: true,
        tenant: true,
        lease: true,
      },
    });

    res.json(updatedApplication);
  } catch (error: any) {
    res
      .status(500)
      .json({ message: `Error updating application status: ${error.message}` });
  }
};