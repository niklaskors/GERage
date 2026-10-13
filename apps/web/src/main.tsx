import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "react-oidc-context";
import { WebStorageStateStore } from "oidc-client-ts";
import { App } from "./App";
import { loadConfig } from "./config";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);

loadConfig()
  .then((config) => {
    root.render(
      <StrictMode>
        <AuthProvider
          authority={`https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`}
          client_id={config.userPoolClientId}
          redirect_uri={`${window.location.origin}/`}
          scope="openid email"
          userStore={new WebStorageStateStore({ store: window.localStorage })}
          onSigninCallback={() => window.history.replaceState({}, "", window.location.pathname)}
        >
          <App config={config} />
        </AuthProvider>
      </StrictMode>,
    );
  })
  .catch((err: Error) => root.render(<p className="error">{err.message}</p>));
