/**
 * Converts numeric amounts into Indian English Words (Rupees and Paise)
 * e.g. 1180 -> "Rupees One Thousand One Hundred Eighty Only"
 */
export function numberToWords(amount: number): string {
  if (isNaN(amount) || amount === 0) {
    return 'Rupees Zero Only';
  }

  const units = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];

  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertGroup(num: number): string {
    let str = '';
    if (num >= 100) {
      str += units[Math.floor(num / 100)] + ' Hundred ';
      num %= 100;
    }
    if (num > 0) {
      if (num < 20) {
        str += units[num] + ' ';
      } else {
        str += tens[Math.floor(num / 10)] + ' ';
        if (num % 10 > 0) {
          str += units[num % 10] + ' ';
        }
      }
    }
    return str.trim();
  }

  const absoluteAmount = Math.abs(amount);
  const rupees = Math.floor(absoluteAmount);
  const paise = Math.round((absoluteAmount - rupees) * 100);

  let rupeesStr = '';

  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = rupees % 1000;

  if (crore > 0) {
    rupeesStr += convertGroup(crore) + ' Crore ';
  }
  if (lakh > 0) {
    rupeesStr += convertGroup(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    rupeesStr += convertGroup(thousand) + ' Thousand ';
  }
  if (hundred > 0) {
    rupeesStr += convertGroup(hundred) + ' ';
  }

  rupeesStr = rupeesStr.trim();
  if (!rupeesStr) {
    rupeesStr = 'Zero';
  }

  let result = `Rupees ${rupeesStr}`;

  if (paise > 0) {
    result += ` and ${convertGroup(paise)} Paise`;
  }

  return `${result} Only`;
}
