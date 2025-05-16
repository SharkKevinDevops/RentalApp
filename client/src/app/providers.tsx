// this is for any app or for
// any libararies that need some kind of
// Provider we need to wrap the entire layout for
// so we're going to seperate file

"use client";

import StoreProvider from "@/state/redux";
import { Authenticator } from "@aws-amplify/ui-react";
import Auth from "./(auth)/authProvider";

const Providers = ({ children }: { children: React.ReactNode }) => {
    return (
        <StoreProvider>
            <Authenticator.Provider>
                <Auth>{children}</Auth>
            </Authenticator.Provider>
        </StoreProvider>
    )
};

export default Providers;