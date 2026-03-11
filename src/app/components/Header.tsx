import { Link } from "react-router";
import logoImage from "figma:asset/48de195d09839b5e2071e781c31fa390056b1db8.png";

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logoImage} alt="Magrit" className="w-8 h-8 rounded-lg" />
          <span className="font-semibold text-gray-900">Magrit</span>
        </Link>
        
        <nav className="flex items-center gap-8">
          <a href="#" className="text-sm text-gray-700 hover:text-gray-900">Home</a>
          <a href="#" className="text-sm text-gray-700 hover:text-gray-900">Commercial print</a>
          <a href="#" className="text-sm text-gray-700 hover:text-gray-900">Marketing</a>
          <a href="#" className="text-sm text-gray-700 hover:text-gray-900">Commercial printed flyer</a>
        </nav>

        <button className="px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded text-sm font-medium">
          Calculer le prix
        </button>
      </div>
    </header>
  );
}