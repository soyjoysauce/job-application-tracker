// Route table. Pages inside <ProtectedRoute> require a session; <Layout> gives them the shell.
import { Navigate, Route, Routes } from 'react-router';

import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import AccountPage from './pages/AccountPage';
import ApplicationsPage from './pages/ApplicationsPage';
import NewPostingPage from './pages/NewPostingPage';
import NotFoundPage from './pages/NotFoundPage';
import PostingDetailPage from './pages/PostingDetailPage';
import PostingsPage from './pages/PostingsPage';
import ProfilePage from './pages/ProfilePage';
import SignInPage from './pages/SignInPage';

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignInPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/postings" replace />} />
          <Route path="/postings" element={<PostingsPage />} />
          {/* "new" must come before ":id", or it would be read as a posting id. */}
          <Route path="/postings/new" element={<NewPostingPage />} />
          <Route path="/postings/:id" element={<PostingDetailPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
