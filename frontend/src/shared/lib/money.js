const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** An amount of dollars as money: 435.4 -> "$435.40", 1250 -> "$1,250.00" (missing counts as 0). */
export const formatMoney = (value) => USD.format(Number(value) || 0);

export default formatMoney;
