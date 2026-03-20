import { Routes, Route } from "react-router";

function HomePage(): React.JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">OpShield</h1>
        <p className="mt-2 text-lg text-gray-600">
          Platform layer for the Redbay product suite
        </p>
      </div>
    </div>
  );
}

export function App(): React.JSX.Element {
  return (
    <Routes>
      <Route index element={<HomePage />} />
    </Routes>
  );
}
