// ─── Sidebar Component ───────────────────────────────────────────────────────

import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HiOutlineHome,
  HiOutlineCalendar,
  HiOutlineSearch,
  HiOutlineClipboardList,
  HiOutlineUserGroup,
  HiOutlineClock,
  HiOutlineExclamationCircle,
  HiOutlineDocumentText,
  HiOutlinePlusCircle,
} from 'react-icons/hi';

const sidebarStyles = {
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: 'var(--sidebar-width)',
    height: '100vh',
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--glass-border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 200,
    overflow: 'hidden',
    transition: 'width var(--transition-base)',
  },
  logo: {
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderBottom: '1px solid var(--glass-border)',
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 'var(--radius-lg)',
    background: 'var(--accent-gradient)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    flexShrink: 0,
  },
  logoText: {
    fontWeight: 700,
    fontSize: '1.1rem',
    lineHeight: 1.2,
    color: 'var(--text-primary)',
  },
  logoSub: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  nav: {
    flex: 1,
    padding: '16px 12px',
    overflowY: 'auto',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '0.65rem',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '0 12px',
    marginBottom: '8px',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-secondary)',
    textDecoration: 'none',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    transition: 'all 150ms ease',
    marginBottom: '2px',
  },
  activeLink: {
    background: 'rgba(79, 70, 229, 0.08)',
    color: 'var(--accent-primary)',
  },
};

const navItems = {
  patient: [
    { section: 'Overview', items: [
      { path: '/patient', icon: HiOutlineHome, label: 'Dashboard', end: true },
    ]},
    { section: 'Appointments', items: [
      { path: '/patient/doctors', icon: HiOutlineSearch, label: 'Find Doctors' },
      { path: '/patient/appointments', icon: HiOutlineCalendar, label: 'My Appointments' },
    ]},
  ],
  doctor: [
    { section: 'Overview', items: [
      { path: '/doctor', icon: HiOutlineHome, label: 'Dashboard', end: true },
    ]},
    { section: 'Patient Care', items: [
      { path: '/doctor/appointments', icon: HiOutlineCalendar, label: 'Appointments' },
    ]},
  ],
  admin: [
    { section: 'Overview', items: [
      { path: '/admin', icon: HiOutlineHome, label: 'Dashboard', end: true },
    ]},
    { section: 'Management', items: [
      { path: '/admin/doctors', icon: HiOutlineUserGroup, label: 'Doctors' },
      { path: '/admin/doctors/new', icon: HiOutlinePlusCircle, label: 'Add Doctor' },
      { path: '/admin/leaves', icon: HiOutlineClock, label: 'Leave Management' },
    ]},
    { section: 'Records', items: [
      { path: '/admin/appointments', icon: HiOutlineClipboardList, label: 'All Appointments' },
      { path: '/admin/notifications', icon: HiOutlineExclamationCircle, label: 'Failed Notifications' },
    ]},
  ],
};

export default function Sidebar() {
  return null;
}
