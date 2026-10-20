import Link from "next/link";

export default function NotFound() {
  return <section className="panel empty-state"><p className="eyebrow">404</p><h1>Бұл бет табылмады</h1><p>Мекенжайды тексеріңіз немесе басты бетке оралыңыз.</p><Link href="/" className="button button-primary">Басты бетке оралу</Link></section>;
}
