// Enables client side features in Next.js
"use client";

// Importing necessary components and hooks
import SettingsForm from "@/components/SettingsForm";

// Importing custom hooks fromt the app's Redux Toolkit API slice
import {
    useGetAuthUserQuery,
    useUpdateTenantSettingsMutation,
} from "@/state/api";
import React from "react";


// Function component for the Settings page 
const TenantSettigs = () => {
    // destructure the auth user data and loading state from the hook
    const { data: authUser, isLoading } = useGetAuthUserQuery();

    // Destructure the mutation function used to update tenant settings
    const [updateTenant] = useUpdateTenantSettingsMutation();

    // show a loading state while user data is beign fetched
    if (isLoading) return <div>Loading...</div>;

    // Extract the initial data from the fetched user data
    const initialData = {
        name: authUser?.userInfo.name,
        email: authUser?.userInfo.email,
        phoneNumber: authUser?.userInfo.phoneNumber,
    }

    // Function to handle form submission
    const handleSubmit = async (data: typeof initialData ) => {
        try {
            // Call the mutation function to update tenant settings
            await updateTenant({
                cognitoId: authUser?.cognitoInfo.userId,  // User ID from Cognito
                ...data,  // Spread the form data
            });
        } catch (error) {
            console.error("Error updating tenant settings:", error);
        }
    };

    // Render the SettingsForm component with necessary props
    return (
        <SettingsForm
            initialData={initialData}   // default values for the form
            onSubmit={handleSubmit} // Function to handle form submission
            userType="tenant" // Used for UI display like "Tenant Settings"
        />
    );
}

// Exporting the component for use in routing/pages
export default TenantSettigs;