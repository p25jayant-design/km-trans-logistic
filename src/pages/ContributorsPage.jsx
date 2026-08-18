import React from 'react';
import { motion } from 'framer-motion';
import { Users, Linkedin, GraduationCap, Mail } from 'lucide-react';
import debjitPhoto from '../assets/contributor-debjit.png';
import pranitPhoto from '../assets/contributor-pranit.png';
import jayantPhoto from '../assets/contributor-jayant.png';

/** One contributor's card: circular photo, name/role, and a small row of
 *  outbound-link icon buttons underneath — a website/LinkedIn link plus a
 *  separate mailto link, kept as two distinct icon buttons per the request
 *  rather than combined into one, so each opens exactly what its icon shows. */
function ContributorCard({ photo, name, role, linkHref, linkLabel, linkIcon: LinkIcon, email }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center rounded-2xl border border-line bg-surface p-6 text-center shadow-card transition-shadow hover:shadow-cardHover"
    >
      <div className="rounded-full bg-gradient-to-br from-brand-500 to-brand-700 p-[3px] shadow-card">
        <img
          src={photo}
          alt={name}
          className="h-32 w-32 rounded-full border-[3px] border-surface object-cover"
        />
      </div>

      <h3 className="mt-4 text-[15px] font-bold text-ink">{name}</h3>
      <p className="mt-0.5 text-[12px] font-medium text-ink-faint">{role}</p>

      <div className="mt-4 flex items-center gap-2.5">
        <a
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          title={linkLabel}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-soft text-ink-soft transition-colors hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
        >
          <LinkIcon size={16} />
        </a>
        <a
          href={`mailto:${email}`}
          title={email}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface-soft text-ink-soft transition-colors hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700"
        >
          <Mail size={16} />
        </a>
      </div>
    </motion.div>
  );
}

const CONTRIBUTORS = [
  {
    photo: debjitPhoto,
    name: 'Prof. Debjit Roy',
    role: 'Faculty Guide · Indian Institute of Management, Ahmedabad',
    linkHref: 'https://www.iima.ac.in/faculty-research/faculty-directory/debjit-roy',
    linkLabel: 'Faculty profile at IIM Ahmedabad',
    linkIcon: GraduationCap,
    email: 'debjit@iima.ac.in',
  },
  {
    photo: pranitPhoto,
    name: 'Pranit Rastogi',
    role: 'Contributor',
    linkHref: 'https://www.linkedin.com/in/pranit-rastogi/',
    linkLabel: 'LinkedIn profile',
    linkIcon: Linkedin,
    email: 'p25pranit@iima.ac.in',
  },
  {
    photo: jayantPhoto,
    name: 'Jayant Gangwar',
    role: 'Contributor',
    linkHref: 'https://www.linkedin.com/in/jayant-gangwar/',
    linkLabel: 'LinkedIn profile',
    linkIcon: Linkedin,
    email: 'p25jayant@iima.ac.in',
  },
];

/** Standalone "who built this" page — deliberately kept out of the main
 *  simulation tab bar (Live / Bay Utilization / Worker Utilization / Flow
 *  Time), since it isn't a view onto the simulation itself. Reached instead
 *  via its own link in the Navbar masthead (see Navbar.jsx). */
export default function ContributorsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-col items-center text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white shadow-card">
          <Users size={20} />
        </div>
        <h1 className="mt-3 text-[19px] font-bold text-ink">Contributors</h1>
        <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-ink-faint">
          This workshop simulation was built as a project at IIM Ahmedabad, under academic guidance.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CONTRIBUTORS.map((c) => (
          <ContributorCard key={c.name} {...c} />
        ))}
      </div>
    </div>
  );
}
