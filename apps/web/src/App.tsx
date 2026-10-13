import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "react-oidc-context";
import type { Config } from "./config";
import { CarsPage, type PageProps } from "./CarsPage";
import { carColor, selectedCar, type CarColor, type GerageData } from "./data";
import { LanguageSwitch } from "./LanguageSwitch";
import { Loading } from "./Loading";
import { UserMenu } from "./UserMenu";
import { PixelCar, setFavicon } from "./PixelCar";
import { RegistrationPage } from "./RegistrationPage";
import { Link, useLocation } from "./router";
import { Storage, type Snapshot } from "./storage";
import { logTrips } from "./tripLog";

export function App({ config }: { config: Config }) {
  const auth = useAuth();
  const { t, i18n } = useTranslation();
  // The logo takes the colour of the selected car once the cars are loaded.
  const [logoColor, setLogoColor] = useState<CarColor>("blue");

  useEffect(() => setFavicon(logoColor), [logoColor]);

  if (auth.isLoading) return <Loading label={t("app.loading")} />;
  if (auth.error || !auth.isAuthenticated || !auth.user) {
    return (
      <main className="sign-in">
        <div className="sign-in-card">
          <div className="sign-in-car">
            <Logo />
          </div>
          <h1>GERage</h1>
          <p className="sign-in-tagline">{t("app.tagline")}</p>
          {auth.error && (
            <p className="sign-in-error" role="alert">
              {t("app.loginFailed", { message: auth.error.message })}
            </p>
          )}
          {/* Cognito's login page shows in the same language as the app. */}
          <button
            className="sign-in-button"
            onClick={() => auth.signinRedirect({ extraQueryParams: { lang: i18n.resolvedLanguage ?? "nl" } })}
          >
            {t("app.signIn")}
          </button>
        </div>
        <LanguageSwitch />
      </main>
    );
  }

  const signOut = async () => {
    await auth.removeUser();
    const params = new URLSearchParams({
      client_id: config.userPoolClientId,
      logout_uri: `${window.location.origin}/`,
    });
    window.location.href = `${config.cognitoDomain}/logout?${params}`;
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <Logo color={logoColor} />
            GERage
          </Link>
          <Nav />
          <div className="topbar-actions">
            <UserMenu email={auth.user.profile.email ?? ""} onSignOut={signOut} />
          </div>
        </div>
      </header>
      <main>
        <Garage config={config} idToken={auth.user.id_token!} onLogoColor={setLogoColor} />
      </main>
    </>
  );
}

/** A pixel-art car in 3D, in the colour of the selected car. */
function Logo({ color = "blue" }: { color?: CarColor }) {
  return <PixelCar className="logo" color={color} />;
}

function Nav() {
  const { t } = useTranslation();
  const { path } = useLocation();
  const pages = [
    { to: "/", label: t("nav.registration") },
    { to: "/cars", label: t("nav.cars") },
  ];
  return (
    <nav className="tabs">
      {pages.map((page) => (
        <Link key={page.to} to={page.to} aria-current={path === page.to ? "page" : undefined}>
          {page.label}
        </Link>
      ))}
    </nav>
  );
}

function Garage({
  config,
  idToken,
  onLogoColor,
}: {
  config: Config;
  idToken: string;
  onLogoColor: (color: CarColor) => void;
}) {
  const [storage, setStorage] = useState<Storage>();
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const { t } = useTranslation();
  const { path, query } = useLocation();

  const data = snapshot?.data;
  const car = data && selectedCar(data, query.get("car"));
  const color = data && car ? carColor(car, data.cars.indexOf(car)) : "blue";
  useEffect(() => onLogoColor(color), [color, onLogoColor]);

  useEffect(() => {
    let cancelled = false;
    Storage.create(config, idToken)
      .then(async (s) => {
        // In development StrictMode mounts twice; the first mount is cancelled before its
        // credentials arrive, so this skips a second fetch of the data file.
        if (cancelled) return;
        const loaded = await s.load();
        if (cancelled) return;
        setStorage(s);
        setSnapshot(loaded);
      })
      .catch((err: Error) => setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [config, idToken]);

  if (error) return <p className="error">{error}</p>;
  if (!storage || !snapshot) return <Loading label={t("app.loadingCars")} />;

  const update = async (change: (data: GerageData) => GerageData) => {
    setSaving(true);
    setError(undefined);
    try {
      setSnapshot(await storage.update(snapshot, change));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const { cars, trips } = snapshot.data;
  const tripsByCar = new Map(cars.map((car) => [car.id, logTrips(car, trips.filter((trip) => trip.carId === car.id))]));
  const props: PageProps = { data: snapshot.data, tripsByCar, saving, update };

  return path === "/cars" ? <CarsPage {...props} /> : <RegistrationPage {...props} />;
}
