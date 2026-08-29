import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { user, logout } = useAuth();

  return (
    <nav className="top-nav">
      <NavLink className="nav-brand" to="/" end>
        VisionWaste
      </NavLink>
      <div className="nav-links">
        <NavLink className="nav-link" to="/" end>
          Dashboard
        </NavLink>
        <NavLink className="nav-link" to="/hygienic-risk">
          Risk dashboard
        </NavLink>
        <NavLink className="nav-link" to="/mobile-report">
          Phone camera
        </NavLink>
        <NavLink className="nav-link" to="/map">
          Map
        </NavLink>
        <NavLink className="nav-link" to="/admin">
          Admin
        </NavLink>
        <NavLink className="nav-link" to="/speaker">
          Speaker check
        </NavLink>
        {user && (
          <button type="button" className="btn btn-secondary nav-logout" onClick={logout}>
            Log out ({user.email})
          </button>
        )}
      </div>
    </nav>
  );
}
