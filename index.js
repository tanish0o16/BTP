//Typing Tagline 
const TypingTagline = document.getElementById("TypingTagline");
const taglines = [
  "Accurate. Affordable. Transparent.",
  "Precision You Can Trust.",
];
let i = 0;
let j = 0;
let forward = true;
type = (i) => {
  TypingTagline.textContent = taglines[i].slice(0, j);
  if (forward == true) {
    j++;
    if (j <= taglines[i].length) {
      setTimeout(type, 120,i);
    } else {
      forward = false;
      TypingTagline.classList.add("blink");
      setTimeout(type, 800,i);
    }
  } else {
    TypingTagline.classList.remove("blink");
    j--
    if (j < 0) {
      forward = true;
      setTimeout(type, 100,(i + 1) % taglines.length);
      j = 0;
    } else setTimeout(type, 50,i);
  }
};

type(i);
