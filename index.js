import { isLabelWithInternallyDisabledControl } from '@testing-library/user-event/dist/utils';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';

// import { App } from './components/app';

import './global-styles/main.scss';

import reportWebVitals from './reportWebVitals';

// CODEPEN STARTS HERE
const Button = ({ id, className, value, mathValue, operatorGlow, onClick }) => {
  const debounceTimoutId = useRef('');
  const buttonELement = document.querySelector(`#${id}`);

  const handleKeyPress = useCallback((e) => {// No keyboard input for Plus/Minus Sign
    let key = e.key;

    function setButtonOverlayEffect() {
      buttonELement.classList.add('clicked');

      clearTimeout(debounceTimoutId.current);
  
      debounceTimoutId.current = setTimeout(() => {
        buttonELement.classList.remove('clicked');
      }, 100);
    }

    if (key === String(value) || (key === 'Backspace' && (value === 'C' || value === 'AC'))) {
      onClick(null, value);

      setButtonOverlayEffect();
    } else if (key === mathValue) {
      onClick(null, mathValue);

      setButtonOverlayEffect();
    } else if (key === 'Enter' && value === '=') {
      e.preventDefault();

      onClick();

      setButtonOverlayEffect();
    }
  }, [onClick, value, mathValue, buttonELement]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);

    return function() {
      document.removeEventListener('keydown', handleKeyPress);
    }
  }, [handleKeyPress]);

  return (
    <button 
      id={id}
      className={`${className}${(operatorGlow?.shouldGlow && operatorGlow.glowOperator === mathValue) ? ' active' : ''}`}
      value={mathValue ?? value}
      onClick={onClick}
    >
    {value}
    </button>
  );
};

const Display = React.forwardRef(({ value }, ref) => {
  return (
    <div className="display-area">
      <div id="display" ref={ref}>{value}</div>
    </div>
  );
});

const App = () => {
  const [currentValue, setCurrentValue] = useState('');
  const [operator, setOperator] = useState('');
  const [operatorEntered, setOperatorEntered] = useState(false);
  const [displayError, setDisplayError] = useState(false);
  const [maxDigitLength] = useState(9);// maximum digit length on calculator display
  const [operatorGlow, setOperatorGlow] = useState({
    shouldGlow: false,
    glowOperator: ''
  });

  /*
  In "5 + 4 * 3 * 2 *|+" [where "*|+" indicates alternating between the mathematical operators (spamming) "\", "*", "+", and "-"
  till infinity], we can break the expression into two groups:
  1. The pendingExpression: "5 + " (lower order)
  2. The higherOrderTotal: "4 * 3 * 2" (higher order)
  
  First, the pendingExpression is separated
  Next, the higherOrderTotal is constantly updated (ie. in this case 24)
  Finally, displayedValue depends on the next operator pressed:
  - If "+" or "-" is next, setCurrentValue(5 + 24) (ie. 29) => it is completely resolved
  - If "\" or "*" is next, setCurrentValue(24) => it is not resolved and pendingExpression remains...pending
  */
  const pendingExpression = useRef('');
  const higherOrderTotal = useRef('');
  const repeatingExpression = useRef('');// value repeated when spamming the 'equals' button

  const appElement = useRef(null);
  const displayElement = useRef(null);
  const calculatedWidth = useRef(null);

  // CALCULATOR FUNCTIONALITY
  const initializeCalculator = useCallback(() => {
    setCurrentValue('');
    setOperator('');
    setOperatorEntered(false);

    pendingExpression.current = '';
    higherOrderTotal.current = '';
    repeatingExpression.current = '';
  }, []);

  const handleInputPress = useCallback((e, input) => {
    let value = e?.target.value ?? input;

    value = String(value);

    setCurrentValue(prev => {
      if (operatorEntered) {
        prev = '';// clear screen and start over

        if (value === '0') return '0';

        setOperatorEntered(false);
      }

      let digitLength = prev.split('').filter(item => item !== '.').length;

      if (digitLength < maxDigitLength) {
        if ((value === '.' && prev.includes('.')) || (prev === '' && value === '0')) return prev;
        
        if (prev === '' && value === '.') {
          prev = '0';
        }

        return `${prev}${value}`;
      }

      return prev;
    });
  }, [operatorEntered, maxDigitLength]);

  const evaluateExpression = useCallback((...arg) => {
    // return an evaluation of the concatenated arguments with precision (double minus converted into plus)
    return String(eval(arg.join('').replace(/--/g, '+')));
  }, []);

  function updateExpressionParameters() {
    // check the value of the previous operator pressed before the displayedValue was changed (for updating operators)
    if ((/\+|-/).test(operator)) {
      let newTotal = evaluateExpression(pendingExpression.current, higherOrderTotal.current);// actual resolution

      pendingExpression.current = `${newTotal}${operator}`;// set new pendingExpression
      
      higherOrderTotal.current = Number(currentValue).toFixed(16);// serves as possible start of higher order chain
    } else if ((/\*|\//).test(operator)) {
      higherOrderTotal.current = evaluateExpression(higherOrderTotal.current, operator, Number(currentValue).toFixed(16));// update higherOrderTotal
    }

    setOperatorEntered(true);// register that an operator was pressed
  }

  function handleOperatorPress(e, input) {
    let value = e?.target.value ?? input;

    // if operator has no value (initial operator press or operator press after equals button)
    if (!operator) {
      higherOrderTotal.current = currentValue || '0';
    }

    if (!operatorEntered) {// if last button pressed before current operator was a digit (ie. displayedValue was changed)
      updateExpressionParameters();
    }

    // check the value of the current operator pressed
    if ((/\+|-/).test(value)) {
      let displayedTotal = evaluateExpression(pendingExpression.current, higherOrderTotal.current);// virtual resolution (on spamming operators)

      setCurrentValue(displayedTotal);
    } else if ((/\*|\//).test(value)) {
      setCurrentValue(String(higherOrderTotal.current));
    }

    setOperator(value)// store the value of the operator pressed
  }

  function handleEqualsPress() {
    if (operator) {
      updateExpressionParameters();

      repeatingExpression.current = (`${operator}${Number(currentValue).toFixed(16)}`).replace(/--/g, '+');

      setOperator('');
    } else {
      higherOrderTotal.current = evaluateExpression(`${Number(currentValue).toFixed(16)}`, repeatingExpression.current);

      /* Review the below line */
      higherOrderTotal.current = isNaN(higherOrderTotal.current) ? 0 : higherOrderTotal.current;
    }

    if (pendingExpression.current) {
      higherOrderTotal.current = evaluateExpression(pendingExpression.current, higherOrderTotal.current);

      pendingExpression.current = '';
    }

    setCurrentValue(higherOrderTotal.current);
  }

  function handlePercentagePress() {
    let result;

    if ((/\+|-/).test(operator)) {
      // due to order of operations, multiply higherOrderTotal by displayValue converted into a percentage
      result = higherOrderTotal.current * Number(currentValue).toFixed(16) / 100;
    } else {
      // simply convert displayValue into a percentage
      result = Number(currentValue).toFixed(16) / 100;

      // resolves issue where old higherOrderTotal is used when percentage button is pressed after pressing "equals" button
      if (!operator) {
        higherOrderTotal.current = result;
      }
    }

    setCurrentValue(String(result));
  }

  function handlePlusMinusPress() {
    if (currentValue.slice(0, 1) === '-') {
      setCurrentValue(prev => {
        prev = prev || '0';

        return prev.slice(1);
      });
    } else {
      setCurrentValue(prev => {
        prev = prev || '0';

        return `-${prev}`;
      });
    }
  }

  function handleClearPress(e, input) {
    let value = e?.target.value ?? input;

    if (value === 'C') {
      setCurrentValue('');
    } else {
      initializeCalculator();
    }
  }

  const formattedCurrentValue = useMemo(() => {
    if (Number(currentValue)) {
      // convert to scientific notation if the limits are exceeded
      const maximumValue = 999_999_999;
      const minimumValue = 0.00000001;

      const negativeSign = (/-/).test(currentValue.slice(0, 1)) ? '-' : '';// store negative sign if present

      // formattingValue is the value we will be working with. It is first converted into an absolute value
      let formattingValue = Math.abs(Number(currentValue));

      if (formattingValue !== 0) {
        if (formattingValue < 1e-100 || formattingValue > 1e160) {
          /* if displayError:
          1. currentValue = 'Error'
          2. conditionally stop operations */
          setDisplayError(true);
        } else if (operatorEntered) {// if operatorEntered (operator was last pressed)
          if (formattingValue > maximumValue || formattingValue < minimumValue) {// if it exceeds the limits
            let valueArray = formattingValue.toExponential(7).replace('+', '').split('e');// remove "+" sign if present, and split by "e" value
  
            let absoluteExponentPower = valueArray[1].replace('-', '');// get the actual digits of exponent without the negative sign
  
            valueArray[0] = Number(valueArray[0].slice(0, maxDigitLength - absoluteExponentPower.length));

            formattingValue = formattingValue.join('e');
          } else if ((/\.|e/g).test(currentValue)) {// if currentValue is a decimal (but within the limits)
            let valueArray = formattingValue.toFixed(maxDigitLength - 1).split('.');// set decimal length, and split by "." value
  
            let significantDecimals = valueArray[1].match(/[1-9]/g);// get the significant decimal digits
            let lastSignificantDigit = significantDecimals?.[significantDecimals.length - 1];// get value of the last significant digit
            let indexOfLastSignificantDigit = valueArray[1].lastIndexOf(lastSignificantDigit);
  
            formattingValue = `${valueArray[0]}.${valueArray[1].slice(0, indexOfLastSignificantDigit + 1)}`;
          }
        }

        let floatingSplit = String(formattingValue).split('.');

        let integerValue = floatingSplit[0];
        let integerFormatted = integerValue.map((item, index, array) => {
          let reverseIndex = array.length - 1 - index;

          if (reverseIndex !== 0 && !(reverseIndex % 3)) {
            return `${item},`;// add a comma
          }

          return item;
        });
      }
    }

    return currentValue || '0';
  }, [currentValue, maxDigitLength, operatorEntered]);

  // EXTRA CALCULATOR STYLING
  const setDisplayFontSize = useCallback(() => {
    // size factors 0.27, 0.23, 0.19, 0.17, 0.15 (based on width of container)
    displayElement.current.style.fontSize = `${(calculatedWidth.current * 0.15) / 16}rem`;
  }, []);

  const setElementSizes = useCallback(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let buttons = document.querySelectorAll('button, #preview-input');

    if (viewportHeight < (1.7 * viewportWidth)) {
      calculatedWidth.current = (viewportHeight / 1.7);
    } else {
      calculatedWidth.current = viewportWidth;
    }

    appElement.current.style.width = `${(calculatedWidth.current / 16)}rem`;
    appElement.current.style.height = `${(calculatedWidth.current * 1.7) / 16}rem`;

    buttons.forEach(item => {
      item.style.fontSize = `${(calculatedWidth.current * 0.08) / 16}rem`;
    });

    setDisplayFontSize();// review when font sizes have to change dynamically
  }, [setDisplayFontSize]);

  useEffect(() => {
    setElementSizes();
    
    window.addEventListener('resize', setElementSizes);

    return function () {
      window.removeEventListener('resize', setElementSizes);
    }
  }, [setElementSizes]);

  useEffect(() => {
    if (operator && (operatorEntered || currentValue === '')) {
      setOperatorGlow({
        shouldGlow: true,
        glowOperator: operator
      });
    } else {
      setOperatorGlow({
        shouldGlow: false,
        glowOperator: ''
      });
    }
  }, [operator, operatorEntered, currentValue]);

  return (
    <div id="calculator" ref={appElement}>
      <Display value={formattedCurrentValue} ref={displayElement} />

      <Button id="clear" className="modifier" value={(currentValue === '') ? 'AC' : 'C'} onClick={handleClearPress} />
      <Button className="modifier" value="&#xb1;" onClick={handlePlusMinusPress} />
      <Button className="modifier" value="&#x25;" onClick={handlePercentagePress} />
      <Button id="divide" className="operator" value="&#xf7;" mathValue="/" operatorGlow={operatorGlow} onClick={handleOperatorPress} />
      <Button id="seven" value={7} onClick={handleInputPress} />
      <Button id="eight" value={8} onClick={handleInputPress} />
      <Button id="nine" value={9} onClick={handleInputPress} />
      <Button id="multiply" className="operator" value="&#xd7;" mathValue="*" operatorGlow={operatorGlow} onClick={handleOperatorPress} />
      <Button id="four" value={4} onClick={handleInputPress} />
      <Button id="five" value={5} onClick={handleInputPress} />
      <Button id="six" value={6} onClick={handleInputPress} />
      <Button id="subtract" className="operator" value="&#x2212;" mathValue="-" operatorGlow={operatorGlow} onClick={handleOperatorPress} />
      <Button id="one" value={1} onClick={handleInputPress} />
      <Button id="two" value={2} onClick={handleInputPress} />
      <Button id="three" value={3} onClick={handleInputPress} />
      <Button id="add" className="operator" value="&#x2b;" mathValue="+" operatorGlow={operatorGlow} onClick={handleOperatorPress} />
      <Button id="zero" value={0} onClick={handleInputPress} />
      <Button id="decimal" value="." onClick={handleInputPress} />
      <Button id="equals" className="operator" value="&#x3d;" onClick={handleEqualsPress} />
    </div>
  );
};
  // TODOS
  // Review formattedCurrentValue (handle excess value)
  // Keyboard input for +/- (P/N)
  // Dynamic font-size
// CODEPEN ENDS HERE

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
