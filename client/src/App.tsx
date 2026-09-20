// Route table. Pages inside <ProtectedRoute> require a session; <Layout> gives them the shell.
import { Navigate, Route, Routes } from 'react-router';

import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import AccountPage from './pages/AccountPage';
import NotFoundPage from './pages/NotFoundPage';
import ProfilePage from './pages/ProfilePage';
import SignInPage from './pages/SignInPage';

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignInPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/profile" replace />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
