// Predefined categories for Sovereign Finance
// AI can extend this list when it encounters new categories

export interface CategoryDef {
    id: string;
    name: string;
    icon: string;
    color: string;
}

export const DEFAULT_CATEGORIES: CategoryDef[] = [
    { id: 'food', name: 'Food & Dining', icon: '🍽️', color: '#FF6B6B' },
    { id: 'groceries', name: 'Groceries', icon: '🛒', color: '#4ECDC4' },
    { id: 'transport', name: 'Transport', icon: '🚗', color: '#45B7D1' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#96CEB4' },
    { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#FFEAA7' },
    { id: 'bills', name: 'Bills & Utilities', icon: '📄', color: '#DDA0DD' },
    { id: 'health', name: 'Health', icon: '🏥', color: '#98D8C8' },
    { id: 'travel', name: 'Travel', icon: '✈️', color: '#F7DC6F' },
    { id: 'subscriptions', name: 'Subscriptions', icon: '📱', color: '#BB8FCE' },
    { id: 'education', name: 'Education', icon: '📚', color: '#85C1E9' },
    { id: 'personal', name: 'Personal Care', icon: '💅', color: '#F8B500' },
    { id: 'gifts', name: 'Gifts', icon: '🎁', color: '#E74C3C' },
    { id: 'income', name: 'Income', icon: '💰', color: '#27AE60' },
    { id: 'transfer', name: 'Transfer', icon: '🔄', color: '#7F8C8D' },
    { id: 'other', name: 'Other', icon: '📦', color: '#95A5A6' },
];

export const getCategoryById = (id: string): CategoryDef | undefined => {
    return DEFAULT_CATEGORIES.find(cat => cat.id === id);
};

export const getCategoryByName = (name: string): CategoryDef | undefined => {
    return DEFAULT_CATEGORIES.find(
        cat => cat.name.toLowerCase() === name.toLowerCase()
    );
};

// Find best matching category for AI suggestions
export const findBestCategory = (input: string): CategoryDef => {
    const lowered = input.toLowerCase();

    // Direct match
    const direct = DEFAULT_CATEGORIES.find(
        cat => cat.id === lowered || cat.name.toLowerCase() === lowered
    );
    if (direct) return direct;

    // Keyword matching
    const keywords: Record<string, string[]> = {
        food: ['restaurant', 'cafe', 'coffee', 'dinner', 'lunch', 'breakfast', 'bar', 'pub'],
        groceries: ['supermarket', 'market', 'store', 'mercadona', 'lidl', 'carrefour'],
        transport: ['uber', 'taxi', 'bus', 'metro', 'train', 'fuel', 'gas', 'parking'],
        entertainment: ['cinema', 'movie', 'concert', 'game', 'netflix', 'spotify'],
        shopping: ['amazon', 'zara', 'clothing', 'electronics'],
        bills: ['electricity', 'water', 'internet', 'phone', 'rent'],
        health: ['pharmacy', 'doctor', 'hospital', 'medicine', 'gym'],
        travel: ['hotel', 'airbnb', 'flight', 'booking'],
        subscriptions: ['monthly', 'subscription', 'premium'],
    };

    for (const [catId, words] of Object.entries(keywords)) {
        if (words.some(word => lowered.includes(word))) {
            return DEFAULT_CATEGORIES.find(cat => cat.id === catId)!;
        }
    }

    // Default to 'other'
    return DEFAULT_CATEGORIES.find(cat => cat.id === 'other')!;
};
