import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Where a signed-in user belongs, by role — used to bounce them off a face
// they're not allowed on (rather than dumping them at a dead end).
const homeFor = (user) => {
  if (user?.role === 'dca') return '/dca';
  if (user?.role === 'county_user' && user?.countyId) return `/county/${user.countyId}`;
  return '/accg';
};

const PrivateRoute = ({ children, adminOnly = false, dcaOnly = false }) => {
  const { isAuthenticated, loading, isAccg, isDca, user } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ACCG-only routes (the ACCG operator pages). Send others to their own face.
  if (adminOnly && !isAccg) {
    return <Navigate to={homeFor(user)} replace />;
  }

  // DCA-only routes (the /dca face). Only the DCA agency role may enter.
  if (dcaOnly && !isDca) {
    return <Navigate to={homeFor(user)} replace />;
  }

  return children;
};

export default PrivateRoute;
