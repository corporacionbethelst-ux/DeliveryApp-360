'use client';

import Link from 'next/link';
import { 
  ArrowRight, Truck, BarChart3, Shield, 
  MapPin, Smartphone, Clock, Zap,
  Menu, X, ChevronDown
} from 'lucide-react';
import { useState, useCallback } from 'react';

// --- Tipos e Interfaces ---
interface FaqItem {
  q: string;
  a: string;
}

interface TestimonialItem {
  quote: string;
  author: string;
  role: string;
}

interface StepItemProps {
  number: string;
  title: string;
  desc: string;
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
}

interface StatItemProps {
  number: string;
  label: string;
}

// --- Datos Estáticos (Movidos fuera del componente para optimizar render) ---
const FAQ_DATA: FaqItem[] = [
  { q: "¿Hay algún costo de instalación?", a: "No, la plataforma es 100% basada en la nube. Solo pagas una suscripción mensual según el tamaño de tu flota." },
  { q: "¿Puedo probarlo antes de comprar?", a: "Sí, ofrecemos 14 días de prueba gratuita con acceso a todas las funcionalidades premium." },
  { q: "¿Funciona para bicicletas y motos?", a: "Absolutamente. Nuestro sistema soporta múltiples tipos de vehículos y calcula rutas específicas para cada uno." }
];

const TESTIMONIALS: TestimonialItem[] = [
  { 
    quote: "La implementación fue inmediata. Redujimos nuestros tiempos de entrega en un 30% el primer mes.",
    author: "Carlos Mendoza",
    role: "CEO, FastFood Express"
  },
  { 
    quote: "Como repartidor, la app es increíblemente fácil de usar. Sé exactamente cuánto voy a ganar cada día.",
    author: "Ana García",
    role: "Repartidora Top Rated"
  }
];

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Handlers optimizados
  const toggleMobileMenu = useCallback(() => setMobileMenuOpen(prev => !prev), []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  
  const toggleFaq = useCallback((index: number) => {
    setOpenFaq(prev => prev === index ? null : index);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-blue-500/30 scroll-smooth">
      
      {/* Navbar Flotante */}
      <header className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 transition-all duration-300">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex justify-between items-center" aria-label="Navegación principal">
            <Link href="/" className="flex items-center space-x-2 group cursor-pointer" aria-label="Ir al inicio">
              <div className="bg-gradient-to-tr from-blue-600 to-cyan-500 p-2 rounded-lg group-hover:shadow-lg group-hover:shadow-blue-500/20 transition-all duration-300">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Delivery360
              </span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <NavLink href="#features">Características</NavLink>
              <NavLink href="#how-it-works">Cómo Funciona</NavLink>
              <NavLink href="#testimonials">Testimonios</NavLink>
              <NavLink href="/login">Iniciar Sesión</NavLink>
              <Link 
                href="/register-rider" 
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 transform hover:-translate-y-0.5 duration-200"
              >
                Empezar Ahora
              </Link>
            </div>

            {/* Mobile Toggle */}
            <button 
              className="md:hidden text-slate-300 hover:text-white transition-colors p-2"
              onClick={toggleMobileMenu}
              aria-label={mobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </nav>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-4 space-y-4 animate-in slide-in-from-top-5 fade-in duration-200">
            <MobileNavLink href="#features" onClick={closeMobileMenu}>Características</MobileNavLink>
            <MobileNavLink href="#how-it-works" onClick={closeMobileMenu}>Cómo Funciona</MobileNavLink>
            <MobileNavLink href="/login" onClick={closeMobileMenu}>Iniciar Sesión</MobileNavLink>
            <Link 
              href="/register-rider" 
              className="block bg-blue-600 hover:bg-blue-500 text-white text-center py-3 rounded-lg font-semibold transition-colors"
              onClick={closeMobileMenu}
            >
              Registrarse
            </Link>
          </div>
        )}
      </header>

      <main className="pt-24">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 lg:py-32">
          {/* Background Glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] -z-10 animate-pulse" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[100px] -z-10" />

          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700 text-blue-400 text-xs font-medium mb-6 animate-in fade-in zoom-in duration-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Nueva Versión 2.0 Disponible
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold text-white mb-8 tracking-tight leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700">
              Logística Inteligente <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
                Entregas Sin Límites
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
              La plataforma todo-en-uno para gestionar flotas, optimizar rutas en tiempo real 
              y escalar tu negocio de delivery con tecnología enterprise.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
              <Link 
                href="/register-rider" 
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl text-lg font-bold transition shadow-xl shadow-blue-600/20 hover:shadow-blue-600/40 transform hover:-translate-y-1 duration-200 flex items-center justify-center group"
              >
                Comenzar Prueba Gratis
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link 
                href="#demo" 
                className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-8 py-4 rounded-xl text-lg font-semibold transition flex items-center justify-center group"
              >
                <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center mr-3 group-hover:bg-slate-600 transition-colors">
                  <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[8px] border-l-white border-b-[4px] border-b-transparent ml-0.5"></div>
                </div>
                Ver Demo Interactiva
              </Link>
            </div>

            {/* Dashboard Preview Mockup */}
            <div className="relative mx-auto max-w-5xl rounded-2xl bg-slate-900/50 p-2 ring-1 ring-inset ring-slate-800 lg:rounded-3xl lg:p-4 shadow-2xl animate-in fade-in zoom-in duration-1000 delay-300">
              <div className="rounded-xl overflow-hidden bg-slate-800 aspect-[16/9] relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                  <div className="text-center">
                    <BarChart3 className="h-16 w-16 text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Interfaz del Dashboard en Vivo</p>
                  </div>
                </div>
                {/* Overlay simulando UI */}
                <div className="absolute top-4 left-4 right-4 h-12 bg-slate-900/80 rounded-lg blur-sm"></div>
                <div className="absolute top-20 left-4 w-64 h-32 bg-slate-900/60 rounded-lg blur-sm"></div>
                <div className="absolute top-20 right-4 left-72 h-32 bg-blue-900/20 rounded-lg blur-sm"></div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 border-y border-slate-800 bg-slate-900/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <StatItem number="99.9%" label="Uptime Garantizado" />
              <StatItem number="50K+" label="Entregas/Mes" />
              <StatItem number="< 2s" label="Tiempo de Respuesta" />
              <StatItem number="24/7" label="Soporte Humano" />
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 relative">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-blue-400 font-semibold tracking-wide uppercase text-sm mb-3">Potencia Tu Operación</h2>
              <h3 className="text-3xl md:text-4xl font-bold text-white mb-6">Todo lo que necesitas para crecer</h3>
              <p className="text-slate-400 text-lg">
                Desde la asignación automática hasta el análisis financiero, cubrimos cada aspecto de tu negocio.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={<MapPin className="h-6 w-6 text-blue-400" />}
                title="Rastreo GPS en Tiempo Real"
                description="Visualiza la ubicación exacta de cada repartidor con actualización cada 5 segundos."
              />
              <FeatureCard
                icon={<Zap className="h-6 w-6 text-yellow-400" />}
                title="Asignación Automática"
                description="Algoritmos inteligentes que asignan pedidos al repartidor más cercano y disponible."
              />
              <FeatureCard
                icon={<BarChart3 className="h-6 w-6 text-purple-400" />}
                title="Analíticas Financieras"
                description="Reportes detallados de ingresos, costos por kilómetro y rendimiento de flota."
              />
              <FeatureCard
                icon={<Smartphone className="h-6 w-6 text-green-400" />}
                title="App para Repartidores"
                description="Aplicación nativa para iOS y Android con navegación integrada y gestión de ganancias."
              />
              <FeatureCard
                icon={<Shield className="h-6 w-6 text-red-400" />}
                title="Seguridad Enterprise"
                description="Encriptación de extremo a extremo, roles de usuario granulares y auditoría de logs."
              />
              <FeatureCard
                icon={<Clock className="h-6 w-6 text-cyan-400" />}
                title="Gestión de Turnos"
                description="Controla horarios, vacaciones y disponibilidad de tu equipo con un calendario intuitivo."
              />
            </div>
          </div>
        </section>

        {/* Cómo Funciona */}
        <section id="how-it-works" className="py-24 bg-slate-900/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Flujo de Trabajo Simplificado</h2>
              <p className="text-slate-400">Tres pasos para transformar tu logística</p>
            </div>

            <div className="grid md:grid-cols-3 gap-12 relative">
              {/* Línea conectora (solo desktop) */}
              <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900 -z-10"></div>

              <StepItem 
                number="01" 
                title="Configura tu Flota" 
                desc="Registra tus vehículos, define zonas de cobertura y configura tus tarifas base."
              />
              <StepItem 
                number="02" 
                title="Recibe Pedidos" 
                desc="Integra tu e-commerce o crea órdenes manualmente desde el panel de control."
              />
              <StepItem 
                number="03" 
                title="Optimiza y Escala" 
                desc="El sistema asigna rutas, tú monitoreas en vivo y analizas los resultados."
              />
            </div>
          </div>
        </section>

        {/* Testimonios */}
        <section id="testimonials" className="py-24">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-white mb-16">Confían en Delivery360</h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {TESTIMONIALS.map((item, idx) => (
                <TestimonialCard key={idx} {...item} />
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-24 bg-slate-900/30">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="text-3xl font-bold text-center text-white mb-12">Preguntas Frecuentes</h2>
            <div className="space-y-4">
              {FAQ_DATA.map((faq, idx) => (
                <div key={idx} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
                  <button 
                    className="w-full flex justify-between items-center p-6 text-left hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={openFaq === idx}
                    aria-controls={`faq-content-${idx}`}
                  >
                    <span className="font-semibold text-white">{faq.q}</span>
                    <ChevronDown className={`transform transition-transform duration-300 ${openFaq === idx ? 'rotate-180' : ''}`} />
                  </button>
                  <div 
                    id={`faq-content-${idx}`}
                    className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${openFaq === idx ? 'pb-6 max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <p className="text-slate-400">{faq.a}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-blue-600/10 -z-10"></div>
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold text-white mb-6">¿Listo para revolucionar tus entregas?</h2>
            <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
              Únete a las empresas de logística más modernas del mercado.
            </p>
            <Link 
              href="/register-rider" 
              className="bg-white text-blue-900 hover:bg-slate-100 px-10 py-4 rounded-full text-lg font-bold transition shadow-xl transform hover:-translate-y-1 duration-200 inline-block"
            >
              Crear Cuenta Gratuita
            </Link>
            <p className="mt-6 text-sm text-slate-500">
              Sin tarjeta de crédito requerida • Cancela cuando quieras
            </p>
          </div>
        </section>
      </main>

      {/* Footer Profesional */}
      <footer className="bg-slate-950 border-t border-slate-800 pt-16 pb-8">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Truck className="h-6 w-6 text-blue-500" />
                <span className="text-xl font-bold text-white">Delivery360</span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">
                Plataforma líder en gestión logística para la última milla.
              </p>
            </div>
            <FooterColumn title="Producto" links={['Características', 'Precios', 'API']} />
            <FooterColumn title="Compañía" links={['Nosotros', 'Blog', 'Contacto']} />
            <FooterColumn title="Legal" links={['Privacidad', 'Términos']} />
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-slate-600 text-sm">
            &copy; {new Date().getFullYear()} Delivery360 Inc. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- Componentes Auxiliares Tipados ---

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
      {children}
    </Link>
  );
}

function MobileNavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link 
      href={href} 
      className="block text-slate-300 hover:text-white py-2 transition-colors"
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

function StatItem({ number, label }: StatItemProps) {
  return (
    <div className="p-4">
      <div className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-tight">{number}</div>
      <div className="text-slate-500 text-sm font-medium uppercase tracking-wider">{label}</div>
    </div>
  );
}

function StepItem({ number, title, desc }: StepItemProps) {
  return (
    <div className="relative z-10 text-center">
      <div className="w-24 h-24 mx-auto bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-900 shadow-xl mb-6">
        <span className="text-3xl font-bold text-blue-400">{number}</span>
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-slate-400 max-w-xs mx-auto">{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-slate-900/50 rounded-2xl p-8 hover:bg-slate-800/80 transition-all duration-300 border border-slate-800 hover:border-blue-500/30 group">
      <div className="mb-6 bg-slate-800 w-14 h-14 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

function TestimonialCard({ quote, author, role }: TestimonialCardProps) {
  return (
    <div className="bg-slate-900/50 p-8 rounded-2xl border border-slate-800 relative overflow-hidden">
      <div className="text-blue-500 text-6xl font-serif absolute top-4 left-4 opacity-20 select-none">"</div>
      <p className="text-slate-300 text-lg italic mb-6 relative z-10">{quote}</p>
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold shadow-lg">
          {author[0]}
        </div>
        <div>
          <div className="text-white font-semibold">{author}</div>
          <div className="text-slate-500 text-sm">{role}</div>
        </div>
      </div>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="text-white font-semibold mb-4">{title}</h4>
      <ul className="space-y-2 text-sm text-slate-400">
        {links.map((link) => (
          <li key={link}>
            <Link href="#" className="hover:text-blue-400 transition-colors">{link}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}