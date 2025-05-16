import { SettingsFormData, settingsSchema } from "@/lib/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Form } from "./ui/form";
import { CustomFormField } from "./FormField";
import { Button } from "./ui/button";

// component definition
// The setting form contains three props
const SettingsForm = ({
  initialData,      // initial data for the form    
  onSubmit,         // A function to handle form submission
  userType,        // The type of user (e.g., "admin", "user")  
}: SettingsFormProps) => {

    // Use state to manage edit mode
  const [editMode, setEditMode] = useState(false);

  // Set up the form with reacy-hook-form
  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initialData,
  });

  // Function to toggle edit mode
  const toggleEditMode = () => {
    setEditMode(!editMode);
    if (editMode) {
      form.reset(initialData);
    }
  };


  // Handle form submission
  // This function is called when the form is submitted
  const handleSubmit = async (data: SettingsFormData) => {
    await onSubmit(data);
    setEditMode(false); // turn off edit mode after submission
  };


  // Render the form
  return (
    <div className="pt-8 pb-5 px-8">
      <div className="mb-5">
        <h1 className="text-xl font-semibold">
          {`${userType.charAt(0).toUpperCase() + userType.slice(1)} Settings`}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account preferences and personal information
        </p>
      </div>
      <div className="bg-white rounded-xl p-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <CustomFormField name="name" label="Name" disabled={!editMode} />
            <CustomFormField
              name="email"
              label="Email"
              type="email"
              disabled={!editMode}
            />
            <CustomFormField
              name="phoneNumber"
              label="Phone Number"
              disabled={!editMode}
            />

            <div className="pt-4 flex justify-between">
              <Button
                type="button"
                onClick={toggleEditMode}
                className="bg-secondary-500 text-white hover:bg-secondary-600"
              >
                {editMode ? "Cancel" : "Edit"}
              </Button>
              {editMode && (
                <Button
                  type="submit"
                  className="bg-primary-700 text-white hover:bg-primary-800"
                >
                  Save Changes
                </Button>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default SettingsForm;