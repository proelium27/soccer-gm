// Premier League nationality distribution + per-country name pools.
// Weights are relative (not percentages): a country with weight 300 appears
// ~2x as often as weight 150.
export interface NationalityDef {
  weight: number;
  first: string[];
  last: string[];
}

export const NATIONALITIES: Record<string, NationalityDef> = {
  England: {
    weight: 390,
    first: [
      "Harry", "Jack", "James", "George", "Jordan", "Callum", "Mason", "Tyler",
      "Charlie", "Oliver", "Ben", "Sam", "Ryan", "Josh", "Luke", "Connor",
      "Aaron", "Marcus", "Dominic", "Reece", "Curtis", "Ellis", "Kyle", "Declan",
    ],
    last: [
      "Smith", "Jones", "Taylor", "Wilson", "Johnson", "White", "Walker", "Robinson",
      "Wright", "Green", "Hall", "Wood", "Baker", "Clarke", "Cooper", "Ward",
      "Hunt", "Foster", "Bennett", "Grant", "Sterling", "Mount", "Rice", "Kane",
    ],
  },
  France: {
    weight: 63,
    first: [
      "Antoine", "Kylian", "Paul", "Hugo", "Theo", "Ousmane", "Presnel", "Lucas",
      "Corentin", "Adrien", "Aurelien", "Benjamin", "Mathis", "Thomas", "Wesley", "Jules",
      "Moussa", "Ibrahima", "Randal", "Kingsley", "Christopher", "Eduardo", "Marcus", "Bradley",
    ],
    last: [
      "Griezmann", "Mbappe", "Pogba", "Lloris", "Hernandez", "Dembele", "Kimpembe", "Digne",
      "Tolisso", "Rabiot", "Tchouameni", "Pavard", "Coman", "Lemar", "Fofana", "Kounde",
      "Sissoko", "Konate", "Kolo Muani", "Guendouzi", "Nkunku", "Camavinga", "Thuram", "Barcola",
    ],
  },
  Brazil: {
    weight: 63,
    first: [
      "Gabriel", "Lucas", "Rodrigo", "Bruno", "Thiago", "Fabinho", "Casemiro", "Richarlison",
      "Vinicius", "Antony", "Raphinha", "Alisson", "Ederson", "Marquinhos", "Danilo", "Fred",
      "Everton", "Matheus", "Douglas", "Weverton", "Renan", "Arthur", "Fabio", "Rafael",
    ],
    last: [
      "Silva", "Santos", "Souza", "Oliveira", "Costa", "Pereira", "Ferreira", "Alves",
      "Barbosa", "Ribeiro", "Carvalho", "Gomes", "Martins", "Araujo", "Nascimento", "Rocha",
      "Dias", "Moreira", "Cardoso", "Teixeira", "Correia", "Lima", "Fernandes", "Neves",
    ],
  },
  Spain: {
    weight: 33,
    first: [
      "Alvaro", "Sergio", "Pablo", "Pedro", "Alejandro", "Marco", "Ferran", "Dani",
      "Rodrigo", "Gavi", "Ansu", "Nacho", "Jesus", "Cesar", "Ivan", "Ruben",
      "Diego", "Carlos", "Mikel", "Unai",
    ],
    last: [
      "Garcia", "Rodriguez", "Fernandez", "Lopez", "Martinez", "Gonzalez", "Perez", "Sanchez",
      "Ramos", "Torres", "Dominguez", "Vazquez", "Morata", "Alonso", "Navas", "Silva",
      "Herrera", "Pedri", "Merino", "Olmo",
    ],
  },
  Portugal: {
    weight: 31,
    first: [
      "Cristiano", "Bruno", "Bernardo", "Joao", "Diogo", "Ruben", "Pedro", "Rafael",
      "Nuno", "Goncalo", "Vitor", "Danilo", "Rui", "Nelson", "William", "Andre",
      "Renato", "Jose", "Fabio", "Tiago",
    ],
    last: [
      "Silva", "Fernandes", "Ronaldo", "Neves", "Jota", "Dias", "Cancelo", "Guerreiro",
      "Semedo", "Palhinha", "Leao", "Felix", "Ramos", "Pereira", "Carvalho", "Costa",
      "Sanches", "Mendes", "Vieira", "Antunes",
    ],
  },
  Netherlands: {
    weight: 28,
    first: [
      "Virgil", "Frenkie", "Memphis", "Matthijs", "Georginio", "Denzel", "Cody", "Donyell",
      "Steven", "Nathan", "Jurrien", "Xavi", "Teun", "Wout", "Ryan", "Justin",
      "Daley", "Quincy", "Tyrell", "Owen",
    ],
    last: [
      "van Dijk", "de Jong", "Depay", "de Ligt", "Wijnaldum", "Dumfries", "Gakpo", "Malen",
      "Bergwijn", "Ake", "Timber", "Simons", "Koopmeiners", "Weghorst", "Gravenberch", "Blind",
      "Klaassen", "Promes", "Malacia", "Wijndal",
    ],
  },
  Belgium: {
    weight: 22,
    first: [
      "Kevin", "Eden", "Romelu", "Thibaut", "Yannick", "Youri", "Dries", "Axel",
      "Toby", "Jan", "Thomas", "Leandro", "Timothy", "Charles", "Jeremy",
    ],
    last: [
      "De Bruyne", "Hazard", "Lukaku", "Courtois", "Carrasco", "Tielemans", "Mertens", "Witsel",
      "Alderweireld", "Vertonghen", "Meunier", "Trossard", "Castagne", "De Ketelaere", "Doku",
    ],
  },
  Argentina: {
    weight: 20,
    first: [
      "Lionel", "Angel", "Paulo", "Emiliano", "Rodrigo", "Nicolas", "Lautaro", "Julian",
      "Enzo", "Alexis", "Cristian", "Marcos", "German", "Nahuel",
    ],
    last: [
      "Messi", "Di Maria", "Dybala", "Martinez", "De Paul", "Otamendi", "Tagliafico", "Alvarez",
      "Fernandez", "Mac Allister", "Romero", "Acuna", "Montiel", "Molina",
    ],
  },
  Scotland: {
    weight: 18,
    first: ["Andy", "John", "Scott", "Callum", "Ryan", "Kieran", "Stuart", "Grant", "Kenny", "Liam", "Billy", "Robbie", "Nathan", "Aaron"],
    last: ["Robertson", "McTominay", "McGregor", "Tierney", "Hendry", "Christie", "Adams", "Fraser", "Anderson", "Dykes", "Gilmour", "Hickey", "Souttar", "Ralston"],
  },
  Wales: {
    weight: 16,
    first: ["Gareth", "Aaron", "Ben", "Joe", "Daniel", "Ethan", "Harry", "Rhys", "Connor", "Dylan", "Neco", "Kieffer", "Brennan", "Chris"],
    last: ["Bale", "Ramsey", "Davies", "Allen", "James", "Ampadu", "Wilson", "Moore", "Roberts", "Williams", "Rodon", "Johnson", "Colwill", "Mepham"],
  },
  "Republic of Ireland": {
    weight: 15,
    first: ["Sean", "Shane", "Seamus", "Robbie", "James", "Conor", "Josh", "Chiedozie", "Nathan", "Callum", "Adam", "Jason", "Troy", "Evan"],
    last: ["Coleman", "Duffy", "Long", "Brady", "McClean", "Hendrick", "Ogbene", "Collins", "Doherty", "Egan", "Parrott", "Idah", "Cullen", "Ferguson"],
  },
  Denmark: {
    weight: 14,
    first: ["Christian", "Kasper", "Andreas", "Pierre-Emile", "Jannik", "Joakim", "Mikkel", "Rasmus", "Jonas", "Simon", "Victor", "Mathias"],
    last: ["Eriksen", "Schmeichel", "Christensen", "Hojbjerg", "Vestergaard", "Maehle", "Damsgaard", "Kristensen", "Wind", "Kjaer", "Nelsson", "Jensen"],
  },
  Germany: {
    weight: 13,
    first: ["Thomas", "Manuel", "Joshua", "Leon", "Kai", "Ilkay", "Antonio", "Niklas", "Jamal", "Serge", "Timo", "Robin"],
    last: ["Muller", "Neuer", "Kimmich", "Goretzka", "Havertz", "Gundogan", "Rudiger", "Sule", "Musiala", "Gnabry", "Werner", "Gosens"],
  },
  Nigeria: {
    weight: 12,
    first: ["Victor", "Wilfred", "Alex", "Kelechi", "Ola", "Samuel", "Moses", "Ahmed", "Joe", "Calvin", "Frank", "Taiwo"],
    last: ["Osimhen", "Ndidi", "Iwobi", "Iheanacho", "Aina", "Chukwueze", "Simon", "Musa", "Aribo", "Bassey", "Onyeka", "Awoniyi"],
  },
  Croatia: {
    weight: 10,
    first: ["Luka", "Ivan", "Mario", "Marcelo", "Josko", "Dominik", "Andrej", "Borna", "Nikola", "Ante"],
    last: ["Modric", "Perisic", "Mandzukic", "Brozovic", "Gvardiol", "Livakovic", "Kramaric", "Sosa", "Vlasic", "Rebic"],
  },
  Norway: {
    weight: 10,
    first: ["Erling", "Martin", "Sander", "Kristian", "Morten", "Alexander", "Leo", "Stefan", "Fredrik", "Birger"],
    last: ["Haaland", "Odegaard", "Berge", "Thorstvedt", "Thorsby", "Sorloth", "Skjelbred", "Strandberg", "Midtsjo", "Meling"],
  },
  Sweden: {
    weight: 9,
    first: ["Emil", "Alexander", "Dejan", "Viktor", "Robin", "Anthony", "Ludwig", "Mattias", "Jesper", "Isak"],
    last: ["Forsberg", "Isak", "Kulusevski", "Gyokeres", "Olsen", "Elanga", "Augustinsson", "Svanberg", "Karlstrom", "Danielson"],
  },
  Poland: {
    weight: 8,
    first: ["Robert", "Piotr", "Jakub", "Arkadiusz", "Kamil", "Przemyslaw", "Wojciech", "Karol", "Jan", "Sebastian"],
    last: ["Lewandowski", "Zielinski", "Milik", "Kiwior", "Glik", "Frankowski", "Szczesny", "Swiderski", "Bednarek", "Kaminski"],
  },
  Ukraine: {
    weight: 8,
    first: ["Andriy", "Oleksandr", "Ruslan", "Mykola", "Viktor", "Artem", "Taras", "Yevhen", "Denys", "Illia"],
    last: ["Yarmolenko", "Zinchenko", "Malinovskyi", "Mudryk", "Konoplyanka", "Dovbyk", "Sydorchuk", "Trubin", "Bondar", "Sudakov"],
  },
  Ghana: {
    weight: 8,
    first: ["Thomas", "Andre", "Jordan", "Mohammed", "Kudus", "Jerome", "Baba", "Daniel", "Iddrisu", "Christopher"],
    last: ["Partey", "Ayew", "Kudus", "Salisu", "Opoku", "Rahman", "Amartey", "Boateng", "Wollacott", "Antwi"],
  },
  Serbia: {
    weight: 7,
    first: ["Dusan", "Nemanja", "Sergej", "Aleksandar", "Filip", "Luka", "Fillip", "Ivan", "Uros", "Strahinja"],
    last: ["Vlahovic", "Matic", "Milinkovic-Savic", "Mitrovic", "Kostic", "Jovic", "Djuricic", "Ilic", "Racic", "Pavlovic"],
  },
  Cameroon: {
    weight: 7,
    first: ["Andre", "Vincent", "Eric", "Karl", "Christian", "Jean", "Bryan", "Nicolas", "Olivier", "Frank"],
    last: ["Onana", "Aboubakar", "Choupo-Moting", "Toko Ekambi", "Bassogog", "Zambo Anguissa", "Mbeumo", "Ngamaleu", "Ngoumou", "Nkoulou"],
  },
  "Ivory Coast": {
    weight: 6,
    first: ["Nicolas", "Wilfried", "Franck", "Serge", "Max", "Seko", "Eric", "Jean", "Ibrahim", "Christian"],
    last: ["Pepe", "Zaha", "Kessie", "Aurier", "Gradel", "Fofana", "Bailly", "Kone", "Sangare", "Kouassi"],
  },
  "United States": {
    weight: 6,
    first: ["Christian", "Weston", "Tyler", "Gio", "Yunus", "Sergino", "Tim", "Brenden", "Ricardo", "Matt"],
    last: ["Pulisic", "McKennie", "Adams", "Reyna", "Musah", "Dest", "Weah", "Aaronson", "Pepi", "Turner"],
  },
  Switzerland: {
    weight: 5,
    first: ["Granit", "Xherdan", "Manuel", "Ricardo", "Breel", "Yann", "Nico", "Denis", "Steven", "Fabian"],
    last: ["Xhaka", "Shaqiri", "Akanji", "Rodriguez", "Embolo", "Sommer", "Elvedi", "Zakaria", "Zuber", "Schar"],
  },
  Japan: {
    weight: 5,
    first: ["Takefusa", "Kaoru", "Wataru", "Daichi", "Ritsu", "Junya", "Takumi", "Ko", "Ao", "Hidemasa"],
    last: ["Kubo", "Mitoma", "Endo", "Kamada", "Doan", "Ito", "Minamino", "Itakura", "Tanaka", "Morita"],
  },
  "South Korea": {
    weight: 5,
    first: ["Heung-min", "Min-jae", "Hee-chan", "Kang-in", "Gue-sung", "Woo-young", "In-sung", "Chul", "Seung-ho", "Jong-woo"],
    last: ["Son", "Kim", "Hwang", "Lee", "Cho", "Jung", "Kang", "Hong", "Baek", "Yoon"],
  },
  Austria: {
    weight: 4,
    first: ["David", "Marcel", "Marko", "Konrad", "Xaver", "Christoph", "Stefan", "Alexander"],
    last: ["Alaba", "Sabitzer", "Arnautovic", "Laimer", "Schlager", "Baumgartner", "Posch", "Lainer"],
  },
  "Czech Republic": {
    weight: 4,
    first: ["Patrik", "Tomas", "Vladimir", "Antonin", "Ondrej", "Adam", "Lukas", "Jakub"],
    last: ["Schick", "Soucek", "Coufal", "Barak", "Kudela", "Hlozek", "Provod", "Jankto"],
  },
  Turkey: {
    weight: 4,
    first: ["Hakan", "Burak", "Cengiz", "Merih", "Kerem", "Ozan", "Yusuf", "Orkun"],
    last: ["Calhanoglu", "Yilmaz", "Under", "Demiral", "Akturkoglu", "Kabak", "Yazici", "Kokcu"],
  },
  Algeria: {
    weight: 3,
    first: ["Riyad", "Islam", "Baghdad", "Youcef", "Ismael", "Sofiane"],
    last: ["Mahrez", "Slimani", "Bounedjah", "Belaili", "Bennacer", "Feghouli"],
  },
  Morocco: {
    weight: 3,
    first: ["Achraf", "Hakim", "Sofyan", "Yassine", "Youssef", "Noussair"],
    last: ["Hakimi", "Ziyech", "Amrabat", "Bounou", "En-Nesyri", "Mazraoui"],
  },
  Senegal: {
    weight: 3,
    first: ["Sadio", "Kalidou", "Edouard", "Ismaila", "Idrissa", "Nampalys"],
    last: ["Mane", "Koulibaly", "Mendy", "Sarr", "Gueye", "Diatta"],
  },
  Mexico: {
    weight: 3,
    first: ["Hirving", "Raul", "Guillermo", "Edson", "Hector", "Cesar"],
    last: ["Lozano", "Jimenez", "Ochoa", "Alvarez", "Moreno", "Montes"],
  },
  Canada: {
    weight: 2,
    first: ["Alphonso", "Jonathan", "Cyle", "Tajon", "Stephen", "Alistair"],
    last: ["Davies", "David", "Larin", "Buchanan", "Eustaquio", "Johnston"],
  },
  Australia: {
    weight: 2,
    first: ["Mathew", "Aaron", "Ajdin", "Craig", "Jackson", "Riley"],
    last: ["Ryan", "Mooy", "Hrustic", "Goodwin", "Irvine", "McGree"],
  },
  Finland: {
    weight: 2,
    first: ["Teemu", "Glen", "Robin", "Jere", "Fredrik", "Rasmus"],
    last: ["Pukki", "Kamara", "Lod", "Uronen", "Jensen", "Schuller"],
  },
  Romania: {
    weight: 2,
    first: ["Nicolae", "Ianis", "Denis", "Razvan", "George", "Florin"],
    last: ["Stanciu", "Hagi", "Alibec", "Marin", "Puscas", "Tanase"],
  },
  Slovakia: {
    weight: 2,
    first: ["Milan", "Marek", "Stanislav", "Robert", "Juraj", "Ondrej"],
    last: ["Skriniar", "Hamsik", "Lobotka", "Mak", "Kucka", "Duda"],
  },
  Slovenia: {
    weight: 2,
    first: ["Jan", "Benjamin", "Sandi", "Josip", "Timi", "Andraz"],
    last: ["Oblak", "Sesko", "Verbic", "Ilicic", "Kurtic", "Sporar"],
  },
  Iceland: {
    weight: 2,
    first: ["Gylfi", "Kolbeinn", "Birkir", "Aron", "Rurik", "Alfred"],
    last: ["Sigurdsson", "Sigthorsson", "Bjarnason", "Gunnarsson", "Gislason", "Finnbogason"],
  },
  Mali: {
    weight: 2,
    first: ["Yves", "Moussa", "Amadou", "Kalifa", "Boubacar", "Cheick"],
    last: ["Bissouma", "Doumbia", "Haidara", "Coulibaly", "Traore", "Diabate"],
  },
  "Burkina Faso": {
    weight: 1,
    first: ["Bertrand", "Issa", "Cyrille", "Blati", "Edmond", "Steeve"],
    last: ["Traore", "Kabore", "Bayala", "Toure", "Tapsoba", "Yago"],
  },
  "DR Congo": {
    weight: 1,
    first: ["Cedric", "Yannick", "Chancel", "Britt", "Dieumerci", "Gael"],
    last: ["Bakambu", "Bolasie", "Mbemba", "Assombalonga", "Mbokani", "Kakuta"],
  },
  Guinea: {
    weight: 1,
    first: ["Naby", "Ilaix", "Jose", "Mohamed", "Issiaga", "Alseny"],
    last: ["Keita", "Moriba", "Kante", "Bangoura", "Sylla", "Camara"],
  },
  Uruguay: {
    weight: 1,
    first: ["Luis", "Edinson", "Federico", "Rodrigo", "Ronald", "Nahitan"],
    last: ["Suarez", "Cavani", "Valverde", "Bentancur", "Araujo", "Nandez"],
  },
  Colombia: {
    weight: 1,
    first: ["James", "Luis", "Radamel", "Juan", "Davinson", "Yerry"],
    last: ["Rodriguez", "Diaz", "Falcao", "Cuadrado", "Sanchez", "Mina"],
  },
  Ecuador: {
    weight: 1,
    first: ["Moises", "Enner", "Pervis", "Piero", "Michael", "Gonzalo"],
    last: ["Caicedo", "Valencia", "Estupinan", "Hincapie", "Estrada", "Plata"],
  },
  Paraguay: {
    weight: 1,
    first: ["Miguel", "Gustavo", "Angel", "Julio", "Omar", "Gaston"],
    last: ["Almiron", "Gomez", "Romero", "Villalba", "Alderete", "Gimenez"],
  },
  Venezuela: {
    weight: 1,
    first: ["Salomon", "Yangel", "Josef", "Tomas", "Jhon", "Darwin"],
    last: ["Rondon", "Herrera", "Martinez", "Rincon", "Chancellor", "Machis"],
  },
};

// "Other Nations (combined)" bucket — a country is picked uniformly among
// these when the weighted roll lands in that combined slot.
export const OTHER_NATIONS: Record<string, { first: string[]; last: string[] }> = {
  Egypt: { first: ["Mohamed", "Omar", "Mostafa", "Amr", "Ahmed", "Karim"], last: ["Salah", "Hamdi", "Mohamed", "Fathy", "Elneny", "Abdelmonem"] },
  Tunisia: { first: ["Wahbi", "Youssef", "Hannibal", "Ellyes", "Ali", "Naim"], last: ["Khazri", "Msakni", "Mejbri", "Skhiri", "Abdi", "Sliti"] },
  Chile: { first: ["Alexis", "Arturo", "Gary", "Claudio", "Charles", "Ben"], last: ["Sanchez", "Vidal", "Medel", "Bravo", "Aranguiz", "Brereton Diaz"] },
  Peru: { first: ["Paolo", "Christian", "Andre", "Yoshimar", "Renato", "Edison"], last: ["Guerrero", "Cueva", "Carrillo", "Yotun", "Tapia", "Flores"] },
  Bolivia: { first: ["Marcelo", "Erwin", "Juan", "Rodrigo", "Ramiro", "Jose"], last: ["Moreno", "Saavedra", "Arce", "Ramallo", "Vaca", "Sagredo"] },
  Iran: { first: ["Mehdi", "Sardar", "Alireza", "Saman", "Ramin", "Karim"], last: ["Taremi", "Azmoun", "Jahanbakhsh", "Ghoddos", "Rezaeian", "Ansarifard"] },
  China: { first: ["Wu", "Yu", "Wei", "Zhang", "Xiao", "Feng"], last: ["Lei", "Hanchao", "Shihao", "Linpeng", "Zhi", "Jinghao"] },
  India: { first: ["Sunil", "Sandesh", "Gurpreet", "Anirudh", "Manvir", "Udanta"], last: ["Chhetri", "Jhingan", "Sandhu", "Thapa", "Singh", "Turi"] },
  Israel: { first: ["Eran", "Manor", "Dor", "Nir", "Eli", "Tal"], last: ["Zahavi", "Solomon", "Peretz", "Bitton", "Dasa", "Kaplan"] },
  "New Zealand": { first: ["Chris", "Winston", "Sarpreet", "Liberato", "Marko", "Tim"], last: ["Wood", "Reid", "Singh", "Cacace", "Stamenic", "Payne"] },
  Jamaica: { first: ["Leon", "Michail", "Bobby", "Damion", "Kasey", "Shamar"], last: ["Bailey", "Antonio", "Reid", "Lowe", "Palmer", "Nicholson"] },
  "Costa Rica": { first: ["Keylor", "Joel", "Bryan", "Celso", "Francisco", "Yeltsin"], last: ["Navas", "Campbell", "Oviedo", "Borges", "Calvo", "Tejeda"] },
  Honduras: { first: ["Alberth", "Romell", "Andy", "Bryan", "Denil", "Luis"], last: ["Elis", "Quioto", "Najar", "Acosta", "Maldonado", "Palma"] },
  Panama: { first: ["Adalberto", "Cecilio", "Fidel", "Anibal", "Michael", "Eric"], last: ["Carrasquilla", "Waterman", "Escobar", "Godoy", "Murillo", "Davis"] },
  Zambia: { first: ["Patson", "Fashion", "Enock", "Rainford", "Justin", "Emmanuel"], last: ["Daka", "Sakala", "Mwepu", "Kalaba", "Shonga", "Banda"] },
  Kenya: { first: ["Michael", "Victor", "Johanna", "Eric", "Wanyama", "Ayub"], last: ["Olunga", "Wanyama", "Omollo", "Ochieng", "Masika", "Timbe"] },
  Gabon: { first: ["Pierre-Emerick", "Denis", "Mario", "Guelor", "Bruno", "Mario"], last: ["Aubameyang", "Bouanga", "Lemina", "Kanga", "Ecuele Manga", "Ambourouet"] },
  Angola: { first: ["Manucho", "Gelson", "Fabrice", "Show", "Bastos", "Zini"], last: ["Goncalves", "Dala", "Baio", "Fernando", "Miguel", "Buatu"] },
  Tanzania: { first: ["Mbwana", "Simon", "Novatus", "Himid", "Feisal", "Aishi"], last: ["Samatta", "Msuva", "Dickson", "Aboud", "Salum", "Manula"] },
  "South Africa": { first: ["Percy", "Bongani", "Themba", "Lyle", "Ronwen", "Thembinkosi"], last: ["Tau", "Zungu", "Zwane", "Foster", "Williams", "Lorch"] },
};

const OTHER_BUCKET_WEIGHT = 8;

function totalWeight(): number {
  let sum = OTHER_BUCKET_WEIGHT;
  for (const def of Object.values(NATIONALITIES)) sum += def.weight;
  return sum;
}

/** Weighted-random nationality draw matching the Premier League distribution. */
export function pickNationality(rng: () => number): string {
  let roll = rng() * totalWeight();
  for (const [country, def] of Object.entries(NATIONALITIES)) {
    if (roll < def.weight) return country;
    roll -= def.weight;
  }
  const others = Object.keys(OTHER_NATIONS);
  return others[Math.floor(rng() * others.length)];
}

export function namePoolFor(nationality: string): { first: string[]; last: string[] } | undefined {
  return NATIONALITIES[nationality] ?? OTHER_NATIONS[nationality];
}
