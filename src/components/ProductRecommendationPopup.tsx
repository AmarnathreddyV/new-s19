import React from 'react';
import { X, ShoppingCart, Sparkles, Check, ArrowUpRight } from 'lucide-react';
import { S19ProductDetails } from '../data/productCatalog';

interface ProductRecommendationPopupProps {
  product: S19ProductDetails;
  onClose: () => void;
  onSelectPhase?: (phaseId: string) => void;
}

export const ProductRecommendationPopup: React.FC<ProductRecommendationPopupProps> = ({
  product,
  onClose,
  onSelectPhase,
}) => {
  const [added, setAdded] = React.useState(false);

  const handleAdd = () => {
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  return (
    <div className="bg-[#FAF8F4] border border-[#171715]/25 shadow-2xl overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-bottom-6 zoom-in-95 rounded-lg ring-1 ring-black/5">
      {/* Eyebrow strip */}
      <div className="bg-[#171715] text-[#FAF8F4] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#00E5FF] animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#FAF8F4]">
            IXX RECOMMENDED CREAM &bull; {product.code}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[#A6A29A] hover:text-white p-1 transition-colors cursor-pointer"
          title="Dismiss recommendation"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex gap-4 items-center">
        {/* Product photo with smooth hover zoom */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 bg-[#EFECE6] border border-[#C9C3B8] rounded-md overflow-hidden group shadow-inner">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
          />
          <span className="absolute top-1 left-1 bg-[#171715]/90 text-white text-[8px] font-bold tracking-widest px-2 py-0.5 uppercase shadow-sm rounded-xs">
            {product.code}
          </span>
        </div>

        {/* Product details and price */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="text-[9px] uppercase tracking-[0.2em] text-[#6D6A63] font-semibold">
            {product.weight}
          </div>
          <h4 className="text-sm sm:text-base font-bold tracking-tight text-[#171715] leading-snug">
            {product.name}
          </h4>
          <p className="text-xs text-[#6D6A63] italic leading-tight">
            "{product.tagline}"
          </p>
          <p className="text-[10px] text-[#C86D51] font-medium leading-relaxed pt-0.5">
            {product.activesHighlight}
          </p>

          <div className="flex items-center justify-between pt-2">
            <div className="text-base sm:text-lg font-bold text-[#171715] tracking-tight">
              {product.priceFormatted}
            </div>

            <div className="flex items-center gap-2">
              {onSelectPhase && (
                <button
                  type="button"
                  onClick={() => onSelectPhase(product.phaseId)}
                  className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#171715] hover:text-[#C86D51] transition-colors flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Details</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}

              <button
                type="button"
                onClick={handleAdd}
                className={`px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.15em] flex items-center gap-1.5 rounded-full transition-all duration-200 cursor-pointer shadow-sm ${
                  added
                    ? 'bg-emerald-700 text-white shadow-emerald-900/30'
                    : 'bg-[#171715] hover:bg-black text-[#FAF8F4] hover:shadow-md'
                }`}
              >
                {added ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Added to cart</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Add to cart</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
