// Premier League nationality distribution + per-country name pools.
// Weights are relative (not percentages): a country with weight 300 appears
// ~2x as often as weight 150.
//
// Name pools are common civilian names for each country — deliberately NOT
// the names of real footballers, so generated players never read as (or
// combine into) recognizable pros.
//
// Pool sizes scale with how many players a nationality actually generates, not
// with its `weight`: a nation's realized count is the sum of its share across
// every league table (plus the REST tail), so a low-weight nation named by many
// leagues — Senegal, Morocco, Ivory Coast — produces far more players than its
// weight suggests, and a home-league country produces ~500. A name is one draw
// from `first` x one from `last`, so a 10x10 pool covers 100 names against a
// world that generates 8000 players. Rough targets: home-league countries
// ~90x96, heavy tail suppliers ~52x52, mid ~36x36, rare ~24x24. Names within a
// list must be unique and ASCII-only (no accents) — `nationalities.test.ts`
// pins both plus the size floors. `scripts/namePoolProbe.ts` measures the
// duplicate rate a real generated world ends up with.
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
      "Thomas", "Daniel", "Matthew", "Adam", "Nathan", "Liam", "Joe", "Alfie",
      "Archie", "Freddie", "Louie", "Theo", "Ethan", "Noah", "Leo", "Max",
      "Finley", "Toby", "Elliot", "Cameron", "Bradley", "Lewis", "Owen", "Jake",
      "Dylan", "Harvey", "Billy", "Frankie", "Alex", "Will", "Scott", "Andy",
      "Danny", "Michael", "Robbie", "Joel", "Patrick", "Stephen", "Christopher", "Andrew",
      "Peter", "Philip", "Richard", "Robert", "William", "Edward", "Henry", "Charles",
      "Isaac", "Jacob", "Jamie", "Jason", "Jay", "Kieran", "Lee", "Mark",
      "Martin", "Neil", "Nick", "Paul", "Sean", "Simon", "Steven", "Stuart",
      "Tim", "Tom", "Tony", "Victor", "Wayne", "Zach", "Reggie", "Stanley",
    ],
    last: [
      "Smith", "Jones", "Taylor", "Wilson", "Johnson", "White", "Walker", "Robinson",
      "Wright", "Green", "Hall", "Wood", "Baker", "Clarke", "Cooper", "Ward",
      "Hunt", "Foster", "Bennett", "Grant", "Thompson", "Evans", "Roberts", "Turner",
      "Hill", "Moore", "Clark", "Harris", "Lewis", "Allen", "Young", "King",
      "Scott", "Adams", "Mitchell", "Carter", "Phillips", "Parker", "Collins", "Edwards",
      "Morris", "Murphy", "Cook", "Bailey", "Bell", "Kelly", "Howard", "Marsh",
      "Dawson", "Fletcher", "Simpson", "Hudson", "Barnes", "Chapman", "Gibson", "Harrison",
      "Holmes", "Lawson", "Pearson", "Webster", "Atkinson", "Barker", "Bishop", "Brooks",
      "Burton", "Butler", "Cole", "Cox", "Davies", "Day", "Ellis", "Fisher",
      "Fox", "Freeman", "Graham", "Gray", "Griffiths", "Harper", "Hart", "Hawkins",
      "Hayes", "Holland", "Hopkins", "Hughes", "Jackson", "James", "Jenkins", "Knight",
      "Lane", "Lawrence", "Lee", "Lloyd", "Long", "Lowe", "Mason", "Mills",
      "Morgan", "Palmer", "Payne", "Perry", "Powell", "Price", "Reed", "Reid",
      "Richards", "Russell", "Shaw", "Stone", "Sutton", "Walsh", "Watts", "Wells",
    ],
  },
  France: {
    weight: 63,
    first: [
      "Antoine", "Paul", "Hugo", "Theo", "Lucas", "Adrien", "Benjamin", "Thomas",
      "Jules", "Louis", "Leo", "Gabriel", "Raphael", "Arthur", "Nathan", "Ethan",
      "Enzo", "Maxime", "Quentin", "Clement", "Romain", "Julien", "Nicolas", "Alexandre",
      "Baptiste", "Florian", "Guillaume", "Mathis", "Noah", "Sacha", "Yanis", "Mehdi",
      "Karim", "Samir", "Amine", "Ibrahim", "Moussa", "Mamadou", "Idrissa", "Sekou",
      "Pierre", "Francois", "Philippe", "Laurent", "Olivier", "Christophe", "Sebastien", "Damien",
      "Fabien", "Jerome", "Matthieu", "Vincent", "Yann", "Remi", "Thierry", "Alain",
      "Bruno", "Denis", "Eric", "Frederic", "Gregory", "Herve", "Jacques", "Marc",
      "Pascal", "Patrice", "Sylvain", "Xavier", "Yves", "Aurelien", "Bastien", "Corentin",
      "Didier", "Emmanuel", "Fabrice", "Gael", "Hakim", "Ismael", "Jordan", "Loic",
      "Alexis", "Anthony", "Arnaud", "Axel", "Cedric", "Cyril", "Dorian", "Edouard",
      "Evan", "Gabin", "Gaspard", "Lorenzo", "Marius", "Nolan", "Rayan", "Sofiane",
      "Steven", "Tom", "Valentin", "Younes",
    ],
    last: [
      "Martin", "Bernard", "Dubois", "Durand", "Moreau", "Laurent", "Simon", "Michel",
      "Lefebvre", "Leroy", "Roux", "Fournier", "Girard", "Bonnet", "Dupont", "Lambert",
      "Fontaine", "Rousseau", "Vincent", "Faure", "Andre", "Mercier", "Blanc", "Guerin",
      "Boyer", "Garnier", "Chevalier", "Francois", "Legrand", "Gauthier", "Perrin", "Robin",
      "Clement", "Morel", "Henry", "Renard", "Picard", "Marchand", "Traore", "Diallo",
      "Barbier", "Bertrand", "Blanchard", "Caron", "Colin", "Denis", "Deschamps", "Dufour",
      "Dupuis", "Fabre", "Fernandez", "Garcia", "Gautier", "Gerard", "Giraud", "Hubert",
      "Jacquet", "Klein", "Lacroix", "Leclerc", "Lecomte", "Lemoine", "Lopez", "Martinez",
      "Masson", "Meyer", "Morin", "Muller", "Nguyen", "Olivier", "Paris", "Petit",
      "Philippe", "Renaud", "Rey", "Richard", "Robert", "Rodriguez", "Roy", "Schmitt",
      "Barre", "Baudry", "Besson", "Bourgeois", "Brun", "Camus", "Carpentier", "Cordier",
      "Coste", "Delaunay", "Dumas", "Duval", "Gaillard", "Gillet", "Guillot", "Hamon",
      "Lacombe", "Langlois", "Lebrun", "Marty", "Menard", "Millet", "Moulin", "Noel",
      "Poirier", "Prevost", "Riviere", "Rolland", "Sauvage", "Tessier", "Vasseur", "Verdier",
    ],
  },
  Brazil: {
    weight: 63,
    first: [
      "Gabriel", "Lucas", "Rodrigo", "Thiago", "Danilo", "Everton", "Matheus", "Douglas",
      "Renan", "Arthur", "Fabio", "Rafael", "Pedro", "Joao", "Felipe", "Gustavo",
      "Leonardo", "Marcelo", "Vitor", "Caio", "Diego", "Igor", "Andre", "Henrique",
      "Julio", "Leandro", "Murilo", "Otavio", "Paulo", "Ramon", "Samuel", "Sergio",
      "Wesley", "Wallace", "Yago", "Alex", "Emerson", "Kaique", "Davi", "Luan",
      "Adriano", "Alan", "Bernardo", "Bruno", "Carlos", "Cesar", "Claudio", "Cleber",
      "Eduardo", "Erick", "Ezequiel", "Fernando", "Francisco", "Guilherme", "Heitor", "Hugo",
      "Isaac", "Jean", "Jonathan", "Jorge", "Jose", "Juliano", "Kevin", "Luis",
      "Manoel", "Marcos", "Mauricio", "Michel", "Miguel", "Nicolas", "Osvaldo", "Patrick",
      "Ricardo", "Roberto", "Rodolfo", "Rogerio", "Silvio", "Tiago", "Victor", "Wagner",
      "Wellington", "William", "Yuri", "Caua", "Renato", "Filipe", "Antonio", "Edson",
      "Anderson", "Breno", "Cristiano", "Daniel", "Ederson", "Elias", "Enzo", "Fabricio",
      "Geovane", "Ian", "Jadson", "Kaua", "Lorenzo", "Maicon", "Nathan", "Vinicius",
    ],
    last: [
      "Silva", "Santos", "Souza", "Oliveira", "Costa", "Pereira", "Ferreira", "Alves",
      "Barbosa", "Ribeiro", "Carvalho", "Gomes", "Martins", "Araujo", "Nascimento", "Rocha",
      "Dias", "Moreira", "Cardoso", "Teixeira", "Correia", "Lima", "Fernandes", "Neves",
      "Almeida", "Azevedo", "Batista", "Borges", "Campos", "Castro", "Cavalcanti", "Duarte",
      "Farias", "Freitas", "Mendes", "Monteiro", "Nogueira", "Pinto", "Ramos", "Vieira",
      "Aguiar", "Amaral", "Andrade", "Antunes", "Assis", "Barros", "Bezerra", "Brito",
      "Caldeira", "Cunha", "Dantas", "Figueiredo", "Franco", "Guimaraes", "Lacerda", "Leite",
      "Machado", "Magalhaes", "Marques", "Medeiros", "Melo", "Miranda", "Mota", "Moraes",
      "Moura", "Nunes", "Paiva", "Peixoto", "Pinheiro", "Reis", "Sales", "Santiago",
      "Siqueira", "Soares", "Torres", "Vargas", "Xavier", "Alencar", "Bastos", "Bittencourt",
      "Brandao", "Camargo", "Carneiro", "Chaves", "Coelho", "Damasceno", "Fagundes", "Fontes",
      "Furtado", "Godoy", "Guedes", "Lisboa", "Macedo", "Maia", "Marinho", "Menezes",
      "Padilha", "Prado", "Rangel", "Sampaio", "Tavares", "Valente", "Vasconcelos", "Veloso",
      "Vilela",
    ],
  },
  Spain: {
    weight: 33,
    first: [
      "Alvaro", "Sergio", "Pablo", "Pedro", "Alejandro", "Marco", "Dani", "Rodrigo",
      "Jesus", "Cesar", "Ivan", "Ruben", "Diego", "Carlos", "Mikel", "Unai",
      "Adrian", "Alberto", "Antonio", "David", "Fernando", "Francisco", "Gonzalo", "Hector",
      "Hugo", "Javier", "Jorge", "Manuel", "Miguel", "Raul", "Andres", "Angel",
      "Asier", "Borja", "Daniel", "Eduardo", "Enrique", "Felix", "Gabriel", "Guillermo",
      "Ignacio", "Ismael", "Jaime", "Jon", "Jose", "Julian", "Luis", "Marc",
      "Mario", "Martin", "Nicolas", "Oscar", "Pau", "Ramon", "Ricardo", "Roberto",
      "Salvador", "Samuel", "Tomas", "Victor", "Xavier", "Yeray", "Aitor", "Aleix",
      "Alfonso", "Arnau", "Bruno", "Cristian", "Dario", "Emilio", "Fabian", "Gerard",
      "German", "Gorka", "Hernan", "Iago", "Iker", "Inigo", "Isaac", "Izan",
      "Joan", "Joel", "Jonathan", "Josep", "Juan", "Julio", "Lucas", "Marcos",
      "Mateo", "Nacho", "Oriol", "Pol", "Rafael", "Santiago", "Sergi", "Toni",
      "Vicente",
    ],
    last: [
      "Garcia", "Rodriguez", "Fernandez", "Lopez", "Martinez", "Gonzalez", "Perez", "Sanchez",
      "Gomez", "Martin", "Jimenez", "Ruiz", "Hernandez", "Diaz", "Moreno", "Munoz",
      "Alvarez", "Romero", "Gutierrez", "Alonso", "Navarro", "Dominguez", "Vazquez", "Gil",
      "Serrano", "Molina", "Castro", "Ortega", "Delgado", "Aguilar", "Benitez", "Cabrera",
      "Campos", "Cano", "Carrasco", "Castillo", "Cortes", "Crespo", "Domingo", "Duran",
      "Escudero", "Esteban", "Ferrer", "Flores", "Gallego", "Garrido", "Guerrero", "Herrera",
      "Hidalgo", "Ibanez", "Iglesias", "Leon", "Lozano", "Marin", "Medina", "Mendez",
      "Miranda", "Montero", "Morales", "Nieto", "Ochoa", "Pascual", "Pastor", "Pena",
      "Prieto", "Ramirez", "Ramos", "Reyes", "Rios", "Rivera", "Rubio", "Santos",
      "Sanz", "Soto", "Suarez", "Torres", "Vega", "Arias", "Bravo", "Calvo",
      "Carmona", "Cuesta", "Diez", "Fuentes", "Gallardo", "Herrero", "Izquierdo", "Lara",
      "Lorenzo", "Luque", "Marquez", "Merino", "Mora", "Nunez", "Palacios", "Pardo",
      "Parra", "Rey", "Rivas", "Roldan", "Salas", "Sierra", "Varela", "Vidal",
      "Zamora",
    ],
  },
  Portugal: {
    weight: 31,
    first: [
      "Joao", "Diogo", "Ruben", "Pedro", "Rafael", "Nuno", "Goncalo", "Vitor",
      "Rui", "Nelson", "Andre", "Jose", "Fabio", "Tiago", "Bruno", "Miguel",
      "Ricardo", "Hugo", "Paulo", "Sergio", "Carlos", "Antonio", "Manuel", "Francisco",
      "Duarte", "Afonso", "Martim", "Tomas", "Vasco", "Simao", "Bernardo", "Daniel",
      "David", "Eduardo", "Filipe", "Guilherme", "Henrique", "Jaime", "Jorge", "Leonardo",
      "Luis", "Marco", "Mario", "Matias", "Renato", "Rodrigo", "Samuel", "Xavier",
      "Armando", "Emanuel", "Felipe", "Gaspar", "Inacio", "Luciano", "Alexandre", "Alvaro",
      "Artur", "Augusto", "Caetano", "Cesar", "Custodio", "Dinis", "Domingos", "Edgar",
      "Elias", "Ernesto", "Fernando", "Gil", "Gilberto", "Gustavo", "Helder", "Hernani",
      "Horacio", "Ivo", "Joaquim", "Julio", "Lourenco", "Lucas", "Marcelo", "Mateus",
      "Mauro", "Nicolau", "Norberto", "Octavio", "Osvaldo", "Patricio", "Raul", "Reinaldo",
      "Roberto", "Rogerio", "Salvador", "Sancho", "Sebastiao", "Silvio", "Teodoro", "Valentim",
      "Vicente", "Vitorino",
    ],
    last: [
      "Silva", "Pereira", "Costa", "Santos", "Ferreira", "Oliveira", "Rodrigues", "Martins",
      "Sousa", "Fonseca", "Goncalves", "Lopes", "Marques", "Alves", "Almeida", "Ribeiro",
      "Pinto", "Carvalho", "Teixeira", "Moreira", "Correia", "Mendes", "Nunes", "Soares",
      "Vieira", "Monteiro", "Cardoso", "Rocha", "Antunes", "Machado", "Azevedo", "Barbosa",
      "Borges", "Campos", "Coelho", "Cunha", "Dias", "Domingues", "Duarte", "Faria",
      "Freitas", "Gomes", "Leite", "Lima", "Lourenco", "Matos", "Miranda", "Neves",
      "Pacheco", "Paiva", "Pinheiro", "Reis", "Sa", "Sequeira", "Simoes", "Tavares",
      "Torres", "Vaz", "Ventura", "Abreu", "Aguiar", "Amaral", "Andrade", "Araujo",
      "Assuncao", "Baptista", "Barros", "Bastos", "Bento", "Bernardes", "Brito", "Cabral",
      "Camara", "Carmo", "Castro", "Chaves", "Cordeiro", "Cruz", "Esteves", "Fernandes",
      "Fialho", "Figueiredo", "Franco", "Galvao", "Garcia", "Godinho", "Guedes", "Guerreiro",
      "Henriques", "Jesus", "Lacerda", "Loureiro", "Macedo", "Magalhaes", "Maia", "Marinho",
      "Martinho", "Melo", "Mesquita", "Morais", "Moura", "Nogueira", "Pais", "Palma",
      "Passos", "Pedrosa", "Peixoto", "Pires", "Queiroz", "Ramos", "Rebelo", "Resende",
      "Salgado", "Sampaio", "Saraiva", "Silveira", "Valente", "Varela", "Vasconcelos", "Veloso",
    ],
  },
  Italy: {
    weight: 30,
    first: [
      "Marco", "Luca", "Matteo", "Alessandro", "Davide", "Simone", "Andrea", "Francesco",
      "Lorenzo", "Riccardo", "Federico", "Gianluca", "Stefano", "Fabio", "Roberto", "Paolo",
      "Giovanni", "Antonio", "Nicola", "Emanuele", "Daniele", "Cristian", "Filippo", "Enrico",
      "Salvatore", "Massimo", "Vincenzo", "Domenico", "Pietro", "Angelo", "Giuseppe", "Michele",
      "Alberto", "Claudio", "Giorgio", "Sergio", "Mario", "Franco", "Carlo", "Luigi",
      "Maurizio", "Fabrizio", "Alessio", "Gabriele", "Samuele", "Tommaso", "Leonardo", "Edoardo",
      "Giacomo", "Mattia", "Nicolo", "Manuel", "Diego", "Emiliano", "Valerio", "Dario",
      "Ivan", "Raffaele", "Rosario", "Silvio", "Vito", "Aldo", "Cesare", "Dino",
      "Ettore", "Flavio", "Gennaro", "Gianmarco", "Giulio", "Guido", "Ivano", "Lucio",
      "Marcello", "Mirko", "Orlando", "Osvaldo", "Renato", "Rocco", "Ruggero", "Sandro",
      "Saverio", "Tiziano", "Umberto", "Valentino", "Vittorio", "Alfonso", "Amedeo", "Arturo",
      "Corrado", "Elia", "Ferdinando", "Gaetano", "Nino", "Piero",
    ],
    last: [
      "Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci",
      "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Costa", "Giordano",
      "Mancini", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani",
      "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone", "Longo", "Gentile",
      "Martinelli", "Vitale", "Lombardo", "Serra", "Coppola", "De Santis", "D'Angelo", "Marchetti",
      "Parisi", "Villa", "Conte", "Ferraro", "Ferri", "Fabbri", "Bianco", "Marini",
      "Grasso", "Valentini", "Messina", "Sala", "De Angelis", "Gatti", "Pellegrini", "Palumbo",
      "Sanna", "Farina", "Rizzi", "Monti", "Cattaneo", "Morelli", "Amato", "Silvestri",
      "Mazza", "Testa", "Grassi", "Pellegrino", "Carbone", "Giuliani", "Benedetti", "Barone",
      "Rossetti", "Caputo", "Montanari", "Guerra", "Palmieri", "Bernardi", "Martino", "Fiore",
      "De Rosa", "Ferretti", "Bellini", "Basile", "Riva", "Donati", "Piras", "Vitali",
      "Battaglia", "Sartori", "Neri", "Costantini", "Milani", "Pagano", "Ruggiero", "Sorrentino",
    ],
  },
  Netherlands: {
    weight: 28,
    first: [
      "Daan", "Sem", "Lars", "Thijs", "Bram", "Luuk", "Jesse", "Tim",
      "Niels", "Sven", "Koen", "Ruben", "Stijn", "Joris", "Rick", "Tom",
      "Max", "Thomas", "Jasper", "Wouter", "Bas", "Gijs", "Floris", "Pim",
      "Jelle", "Sander", "Maarten", "Niek", "Teun", "Mees", "Arjan", "Bart",
      "Cas", "Dirk", "Erik", "Frank", "Geert", "Harm", "Hendrik", "Jan",
      "Jeroen", "Joep", "Kevin", "Martijn", "Nick", "Olivier", "Pieter", "Rens",
      "Roan", "Robin", "Ronald", "Stef", "Vincent", "Wesley", "Casper", "Daniel",
      "Douwe", "Ferdi", "Gerrit", "Guus", "Hidde", "Huub", "Jaap", "Jorrit",
      "Justin", "Kees", "Klaas", "Lucas", "Marnix", "Matthijs", "Menno", "Mick",
      "Milan", "Nils", "Owen", "Quinten", "Reinier", "Roel", "Ruud", "Siem",
      "Sil", "Thijmen", "Willem", "Wim", "Youri", "Bauke",
    ],
    last: [
      "de Vries", "Jansen", "van den Berg", "Bakker", "Visser", "Smit", "Meijer", "Mulder",
      "Bos", "Vos", "Peters", "Hendriks", "Dekker", "Brouwer", "van Leeuwen", "de Boer",
      "Kuipers", "Veenstra", "Prins", "Huisman", "van der Meer", "Postma", "Scholten", "Willems",
      "Timmermans", "Verhoeven", "Kok", "Jacobs", "Schouten", "Maas", "van Dijk", "van der Wal",
      "van Wijk", "Vink", "Wolters", "Kramer", "Hoekstra", "Dijkstra", "van der Linden", "Groen",
      "Blom", "Koster", "Peeters", "Sanders", "Martens", "Hermans", "van Dam", "Boer",
      "Vermeer", "Kuiper", "Brink", "Groot", "Smits", "Verbeek", "Beekman", "Boersma",
      "Bosch", "Bruins", "Coenen", "Cornelissen", "Dekkers", "Doornbos", "Driessen", "Elzinga",
      "Evers", "Faber", "Franken", "Gerritsen", "Haan", "Hofman", "Hoogland", "Janssen",
      "Kaptein", "Klomp", "Koning", "Kooij", "Kuijper", "Laan", "Lammers", "Meijerink",
      "Mol", "Nijhuis", "Nijland", "Rietveld", "Roelofs", "Rutten", "Schaap", "Schipper",
      "Steenbergen", "Terpstra", "Vermeulen", "Zwart",
    ],
  },
  Belgium: {
    weight: 22,
    first: [
      "Lucas", "Arthur", "Noah", "Louis", "Victor", "Jules", "Adam", "Nathan",
      "Thomas", "Maxime", "Simon", "Antoine", "Romain", "Gilles", "Wout", "Senne",
      "Lars", "Milan", "Robbe", "Seppe", "Kobe", "Jarne", "Brent", "Cedric",
      "Bram", "Dries", "Emile", "Fabrice", "Francois", "Gregory", "Hugo", "Jens",
      "Jonas", "Kevin", "Laurent", "Matthias", "Nicolas", "Olivier", "Pieter", "Quentin",
      "Stijn", "Thibault", "Tim", "Vincent", "Yannick", "Aaron", "Alexander", "Andreas",
      "Arne", "Axel", "Bart", "Benoit", "Christophe", "Daan", "Damien", "David",
      "Dorian", "Elias", "Emiel", "Ferre", "Filip", "Florian", "Geoffrey", "Gert",
      "Guillaume", "Hendrik", "Jan", "Jarno", "Jasper", "Jean", "Jeroen", "Joachim",
      "Joris", "Julien", "Karel", "Koen", "Lander", "Lennert", "Loic", "Luca",
      "Marius", "Martin", "Mathis", "Maxence", "Michiel", "Nico", "Niels", "Pierre",
      "Rik", "Robin", "Ruben", "Sam", "Sander", "Sebastien", "Siebe", "Stan",
      "Stef", "Steven", "Sven", "Tibo", "Tom", "Toon", "Tristan", "Ward",
      "Wim", "Xander", "Yves",
    ],
    last: [
      "Peeters", "Janssens", "Maes", "Jacobs", "Mertens", "Willems", "Claes", "Goossens",
      "Wouters", "De Smet", "Vermeulen", "Hermans", "Pauwels", "Michiels", "Aerts", "De Clercq",
      "Dubois", "Lambert", "Dupont", "Leclercq", "Renard", "Denis", "Lemaire", "Segers",
      "Claessens", "De Backer", "De Cock", "Desmet", "Devos", "Dewaele", "Geerts", "Hendrickx",
      "Lejeune", "Martens", "Meeus", "Moens", "Peters", "Stevens", "Thijs", "Van den Bossche",
      "Verstraeten", "Baert", "Cools", "De Vos", "Engels", "Francken", "Leclerc", "Maertens",
      "Adriaensen", "Bauwens", "Beckers", "Bogaert", "Boons", "Borremans", "Bosmans", "Ceulemans",
      "Charlier", "Christiaens", "Collin", "Coppens", "Cornelis", "Daems", "De Keyser", "De Meyer",
      "De Pauw", "De Ridder", "De Wilde", "Delvaux", "Dumont", "Fontaine", "Gerard", "Gilis",
      "Hubert", "Huys", "Jacques", "Janssen", "Lallemand", "Laurent", "Lecomte", "Legrand",
      "Lemoine", "Lenaerts", "Leroy", "Lievens", "Luyten", "Marchal", "Mercier", "Nys",
      "Poncelet", "Raes", "Rousseau", "Schmitz", "Simon", "Smet", "Snoeck", "Theys",
      "Timmermans", "Van Acker", "Van Damme", "Van Dyck", "Van Hoof", "Van Loo", "Van Rompaey", "Vandenberghe",
      "Vandevelde", "Verbeeck", "Vercammen", "Vergauwen", "Verhaeghe", "Verhoeven", "Verlinden", "Vermeersch",
      "Verstraete", "Wauters",
    ],
  },
  Argentina: {
    weight: 20,
    first: [
      "Nicolas", "Rodrigo", "Cristian", "Marcos", "German", "Nahuel", "Santiago", "Mateo",
      "Joaquin", "Facundo", "Agustin", "Franco", "Ignacio", "Lucas", "Matias", "Tomas",
      "Bruno", "Gonzalo", "Ezequiel", "Federico", "Leandro", "Maximiliano", "Ramiro", "Valentin",
      "Alejandro", "Andres", "Carlos", "Daniel", "Diego", "Emiliano", "Esteban", "Fabian",
      "Gabriel", "Guillermo", "Hernan", "Javier", "Juan", "Julian", "Lautaro", "Luciano",
      "Martin", "Mauro", "Pablo", "Patricio", "Ricardo", "Sebastian", "Sergio", "Victor",
      "Adrian", "Alan", "Axel", "Braian", "Damian", "Dante", "Dario", "Enzo",
      "Gaston", "Ivan", "Jonathan", "Kevin", "Milton", "Nazareno", "Thiago", "Uriel",
    ],
    last: [
      "Gonzalez", "Rodriguez", "Gomez", "Fernandez", "Lopez", "Diaz", "Martinez", "Perez",
      "Garcia", "Sanchez", "Romero", "Sosa", "Alvarez", "Ruiz", "Ramirez", "Flores",
      "Benitez", "Acosta", "Medina", "Herrera", "Aguirre", "Pereyra", "Dominguez", "Molina",
      "Castro", "Correa", "Ferreyra", "Gimenez", "Gutierrez", "Ibarra", "Ledesma", "Luna",
      "Mansilla", "Morales", "Navarro", "Ortiz", "Peralta", "Rios", "Rojas", "Suarez",
      "Torres", "Vargas", "Vega", "Vera", "Villalba", "Zapata", "Silva", "Mendoza",
      "Arce", "Barrios", "Bustos", "Cabrera", "Cardozo", "Carrizo", "Coria", "Escobar",
      "Figueroa", "Godoy", "Guzman", "Juarez", "Leiva", "Maidana", "Ojeda", "Sandoval",
    ],
  },
  Scotland: {
    weight: 18,
    first: [
      "Andy", "John", "Scott", "Callum", "Ryan", "Kieran", "Stuart", "Grant",
      "Kenny", "Liam", "Billy", "Robbie", "Nathan", "Aaron", "Lewis", "Fraser",
      "Euan", "Cameron", "Finlay", "Ross",
      "Adam", "Alastair", "Angus", "Blair", "Calum", "Craig", "David", "Douglas",
      "Duncan", "Ewan", "Gavin", "Gregor", "Hamish", "Iain", "James", "Jamie",
      "Keith", "Malcolm", "Mark", "Murray", "Neil", "Rory", "Sean", "Steven",
    ],
    last: [
      "Campbell", "Stewart", "MacDonald", "Murray", "Ross", "Reid", "Gray", "Duncan",
      "Hamilton", "Wallace", "Kerr", "Ferguson", "Grant", "Boyd", "Craig", "Sinclair",
      "Muir", "Bruce", "Douglas", "Burns",
      "Anderson", "Armstrong", "Bell", "Brown", "Clark", "Crawford", "Davidson", "Dickson",
      "Donaldson", "Fraser", "Gordon", "Graham", "Henderson", "Hunter", "Johnston", "Kelly",
      "MacKenzie", "MacLeod", "Marshall", "Mitchell", "Morrison", "Paterson", "Robertson", "Scott",
      "Simpson", "Smith", "Taylor", "Thomson", "Walker", "Watson", "Wilson", "Young",
    ],
  },
  Wales: {
    weight: 16,
    first: [
      "Gareth", "Aaron", "Ben", "Joe", "Daniel", "Ethan", "Harry", "Rhys",
      "Connor", "Dylan", "Owen", "Morgan", "Ieuan", "Osian", "Tomos", "Gethin",
      "Iwan", "Cai", "Steffan", "Elis",
      "Adam", "Alun", "Arwyn", "Bryn", "Carwyn", "Dafydd", "Evan", "Geraint",
      "Gruffudd", "Harri", "Hywel", "Ioan", "Jac", "Llewelyn", "Marc", "Myrddin",
      "Rhodri", "Sion", "Trefor", "Wyn",
    ],
    last: [
      "Davies", "Williams", "Evans", "Thomas", "Roberts", "Hughes", "Morgan", "Griffiths",
      "Owen", "Rees", "Jenkins", "Powell", "Price", "Morris", "Lloyd", "Edwards",
      "Parry", "Pritchard", "Bowen", "Vaughan",
      "Bevan", "Ellis", "Harris", "Hopkins", "James", "Jones",
      "Lewis", "Phillips", "Prosser", "Richards", "Rowlands", "Walters",
      "Watkins", "Wynne", "Anthony", "Baker", "Cooper", "Fisher", "George", "Howells",
    ],
  },
  "Republic of Ireland": {
    weight: 15,
    first: [
      "Sean", "Shane", "Conor", "Josh", "Nathan", "Callum", "Adam", "Jason",
      "Evan", "Cian", "Darragh", "Eoin", "Fionn", "Oisin", "Padraig", "Ronan",
      "Tadhg", "Cathal", "Niall", "Dara",
      "Aaron", "Barry", "Brendan", "Brian", "Ciaran", "Colm", "Damien", "Darren",
      "Declan", "Donal", "Eamon", "Enda", "Gary", "Ian", "Jack", "James",
      "Kevin", "Liam", "Mark", "Martin", "Michael", "Patrick", "Paul", "Peter",
    ],
    last: [
      "Murphy", "Kelly", "O'Sullivan", "Walsh", "O'Brien", "Byrne", "Ryan", "O'Connor",
      "O'Neill", "Reilly", "Doyle", "McCarthy", "Gallagher", "Doherty", "Kennedy", "Lynch",
      "Murray", "Quinn", "Moore", "Nolan",
      "Brennan", "Burke", "Carroll", "Casey", "Clarke", "Collins", "Connolly", "Daly",
      "Dunne", "Farrell", "Fitzgerald", "Flynn", "Graham", "Hayes", "Healy", "Hogan",
      "Keane", "Kearney", "Maher", "McGrath", "McMahon", "Moran", "O'Donnell", "Power",
      "Regan", "Sheridan", "Sweeney", "Whelan",
    ],
  },
  Denmark: {
    weight: 14,
    first: [
      "Mikkel", "Rasmus", "Jonas", "Simon", "Mathias", "Frederik", "Emil", "Oliver",
      "Magnus", "Oscar", "Malthe", "Anders", "Jacob", "Tobias", "Nikolaj", "Soren",
      "Mads", "Kasper", "Lasse", "Gustav", "Alexander", "Benjamin", "Christian", "Daniel",
      "Elias", "Filip", "Henrik", "Jesper", "Johan", "Kristian", "Martin", "Morten",
      "Noah", "Peter", "Sebastian", "Thomas", "Victor", "William", "Aksel", "Albert",
      "Anton", "Asger", "August", "Bertram", "Carl", "Esben", "Hans", "Jens",
      "Jeppe", "Joakim", "Jorgen", "Karl", "Kim", "Klaus", "Lars", "Ludvig",
      "Marcus", "Mikael", "Nikolai", "Ole", "Steffen", "Svend", "Theodor", "Valdemar",
    ],
    last: [
      "Nielsen", "Jensen", "Hansen", "Pedersen", "Andersen", "Christensen", "Larsen", "Sorensen",
      "Rasmussen", "Jorgensen", "Petersen", "Madsen", "Kristensen", "Olsen", "Thomsen", "Christiansen",
      "Poulsen", "Johansen", "Mortensen", "Knudsen", "Berg", "Carlsen", "Eriksen", "Frederiksen",
      "Holm", "Jacobsen", "Kjaer", "Lauridsen", "Moller", "Olesen", "Schmidt", "Vestergaard",
      "Bach", "Bech", "Bertelsen", "Bruun", "Clausen", "Dahl", "Damgaard", "Friis",
      "Gregersen", "Hedegaard", "Henriksen", "Hermansen", "Iversen", "Jepsen", "Kjeldsen", "Kruse",
      "Lassen", "Lind", "Mikkelsen", "Munk", "Nissen", "Norgaard", "Overgaard", "Ravn",
      "Riis", "Simonsen", "Skov", "Sondergaard", "Steffensen", "Toft", "Vinther", "Winther",
    ],
  },
  Germany: {
    weight: 13,
    first: [
      "Lukas", "Finn", "Jonas", "Leon", "Paul", "Felix", "Maximilian", "Jan",
      "Tim", "Niklas", "Fabian", "Florian", "Tobias", "Moritz", "Philipp", "Sebastian",
      "Simon", "David", "Erik", "Hannes", "Alexander", "Andreas", "Benjamin", "Christian",
      "Daniel", "Dominik", "Elias", "Franz", "Georg", "Henrik", "Jakob", "Johannes",
      "Julian", "Kevin", "Lars", "Manuel", "Marcel", "Markus", "Martin", "Matthias",
      "Michael", "Nico", "Oliver", "Patrick", "Peter", "Robert", "Stefan", "Thomas",
      "Tom", "Wolfgang", "Adrian", "Anton", "Arne", "Bastian", "Bernd", "Carl",
      "Christoph", "Clemens", "Dennis", "Dirk", "Emil", "Ferdinand", "Gregor", "Gunter",
      "Hendrik", "Holger", "Ingo", "Jannik", "Jens", "Joachim", "Jonathan", "Jorg",
      "Karl", "Klaus", "Konstantin", "Leonard", "Linus", "Ludwig", "Marius", "Maurice",
      "Norbert", "Rainer", "Ralf", "Rene", "Sven", "Theo", "Torsten", "Uwe",
      "Valentin", "Vincent", "Volker", "Wilhelm",
    ],
    last: [
      "Muller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker",
      "Schulz", "Hoffmann", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schroder",
      "Neumann", "Braun", "Zimmermann", "Kruger", "Hartmann", "Lange", "Schmitt", "Werner",
      "Schwarz", "Hofmann", "Ziegler", "Brandt", "Kuhn", "Gunther", "Pohl", "Sauer",
      "Arnold", "Barth", "Busch", "Dietrich", "Engel", "Frank", "Fuchs", "Graf",
      "Haas", "Huber", "Jung", "Keller", "Konig", "Lang", "Maier", "Otto",
      "Peters", "Roth", "Schuster", "Vogel", "Albrecht", "Baumann", "Beck", "Berger",
      "Bergmann", "Bohm", "Brenner", "Ebert", "Eckert", "Fiedler", "Franke", "Freitag",
      "Gross", "Hahn", "Heinrich", "Herrmann", "Hess", "Horn", "Jager", "Kaiser",
      "Kern", "Kraus", "Krause", "Kuhlmann", "Lehmann", "Lorenz", "Mayer", "Moser",
      "Nagel", "Neubauer", "Ott", "Pfeiffer", "Reinhardt", "Riedel", "Ritter", "Schafer",
      "Schulte", "Seidel", "Sommer", "Stein", "Thiel", "Vogt", "Voigt", "Walter",
      "Weiss", "Winkler", "Zeller", "Zimmer",
    ],
  },
  Nigeria: {
    weight: 12,
    first: [
      "Chinedu", "Emeka", "Ifeanyi", "Chukwudi", "Obinna", "Uche", "Nnamdi", "Kelechi",
      "Adewale", "Ayodele", "Babatunde", "Olamide", "Segun", "Tunde", "Femi", "Musa",
      "Ibrahim", "Suleiman", "Daniel", "Samuel", "Abiodun", "Ademola", "Afolabi", "Ahmed",
      "Bamidele", "Bright", "Chibuike", "Chidi", "Chijioke", "Chima", "Chinonso", "Damilola",
      "Ebuka", "Ekene", "Emmanuel", "Gbenga", "Godwin", "Henry", "Ikechukwu", "Isaac",
      "Kayode", "Kunle", "Michael", "Nnaemeka", "Obiora", "Okechukwu", "Olumide", "Onyeka",
      "Sadiq", "Seyi", "Sunday", "Taiwo", "Temitope", "Yemi", "Yinka", "Zubairu",
    ],
    last: [
      "Okafor", "Okoye", "Eze", "Nwachukwu", "Obi", "Okonkwo", "Ogunleye", "Adeyemi",
      "Adebayo", "Balogun", "Lawal", "Yusuf", "Abubakar", "Mohammed", "Aliyu", "Chukwu",
      "Nnadi", "Olawale", "Oyelami", "Ekwueme", "Adeleke", "Adesina", "Afolayan", "Agbaje",
      "Ajayi", "Akinyemi", "Amadi", "Aminu", "Anyanwu", "Bello", "Chukwuma", "Ezeh",
      "Idowu", "Igwe", "Iwu", "Kalu", "Madu", "Nwankwo", "Nwosu", "Obasi",
      "Odili", "Ogundipe", "Ojo", "Okeke", "Okoli", "Olaniyan", "Olayinka", "Onwuka",
      "Osagie", "Oyeleke", "Sanusi", "Umeh", "Uzoma", "Adigun",
    ],
  },
  Croatia: {
    weight: 10,
    first: [
      "Luka", "Ivan", "Marko", "Ante", "Josip", "Matej", "Petar", "Tomislav",
      "Stjepan", "Karlo", "Filip", "Lovro", "Roko", "Niko", "Fran", "Duje",
      "Andrej", "Bruno", "Damir", "Danijel", "Dario", "David", "Dominik", "Goran",
      "Hrvoje", "Igor", "Ivica", "Jakov", "Kristijan", "Leon", "Marin", "Mario",
      "Mateo", "Mihael", "Mislav", "Nikola", "Patrik", "Sandro", "Tin", "Vedran",
    ],
    last: [
      "Horvat", "Kovacevic", "Babic", "Maric", "Jukic", "Vukovic", "Knezevic", "Tomic",
      "Novak", "Bozic", "Blazevic", "Grgic", "Saric", "Lovric", "Radic", "Filipovic",
      "Antic", "Barisic", "Bilic", "Brkic", "Cindric", "Colak", "Grubisic", "Ivancic",
      "Jelic", "Juric", "Klaric", "Kralj", "Lukic", "Marinovic", "Matic", "Miletic",
      "Pavic", "Petric", "Rukavina", "Simic", "Sokol", "Tolic", "Vidovic", "Zoric",
    ],
  },
  Norway: {
    weight: 10,
    first: [
      "Magnus", "Henrik", "Jonas", "Sander", "Kristian", "Morten", "Fredrik", "Sondre",
      "Eirik", "Ola", "Lars", "Anders", "Even", "Sindre", "Vegard", "Petter",
      "Aksel", "Andreas", "Bjorn", "Daniel", "Einar", "Emil", "Erlend", "Espen",
      "Filip", "Geir", "Halvor", "Havard", "Jakob", "Jorgen", "Knut", "Marius",
      "Mathias", "Nikolai", "Oskar", "Rune", "Sigurd", "Simen", "Stian", "Trygve",
    ],
    last: [
      "Hansen", "Johansen", "Olsen", "Larsen", "Andersen", "Pedersen", "Nilsen", "Kristiansen",
      "Jensen", "Karlsen", "Johnsen", "Pettersen", "Berg", "Haugen", "Hagen", "Dahl",
      "Aas", "Amundsen", "Bakke", "Bakken", "Brekke", "Christiansen", "Eide", "Ellingsen",
      "Engen", "Fjeld", "Gundersen", "Halvorsen", "Iversen", "Jacobsen", "Knutsen", "Lie",
      "Lund", "Moen", "Myhre", "Nygaard", "Ruud", "Solberg", "Strand", "Vik",
    ],
  },
  Sweden: {
    weight: 9,
    first: [
      "Oscar", "William", "Lucas", "Elias", "Hugo", "Filip", "Anton", "Gustav",
      "Axel", "Erik", "Viktor", "Nils", "Adam", "Albin", "Melvin", "Casper",
      "Alexander", "Anders", "Andreas", "Arvid", "Benjamin", "Bjorn", "Christoffer", "Daniel",
      "David", "Edvin", "Emil", "Fredrik", "Gabriel", "Hampus", "Henrik", "Isak",
      "Jesper", "Johan", "Jonas", "Karl", "Ludvig", "Magnus", "Marcus", "Mattias",
      "Niklas", "Olle", "Patrik", "Rasmus", "Samuel", "Sebastian", "Simon", "Tobias",
    ],
    last: [
      "Andersson", "Johansson", "Karlsson", "Nilsson", "Eriksson", "Larsson", "Olsson", "Persson",
      "Svensson", "Gustafsson", "Pettersson", "Jonsson", "Jansson", "Hansson", "Bengtsson", "Lindberg",
      "Lindgren", "Lindqvist", "Berg", "Bergstrom", "Lundberg", "Lundgren", "Lundqvist", "Berglund",
      "Sandberg", "Nystrom", "Holm", "Sjoberg", "Wallin", "Engstrom", "Eklund", "Danielsson",
      "Hakansson", "Lind", "Fransson", "Blomqvist", "Nordstrom", "Ahlberg", "Falk", "Hedlund",
      "Isaksson", "Martensson", "Nyberg", "Oberg", "Sundberg", "Soderberg", "Strom", "Ostlund",
    ],
  },
  Poland: {
    weight: 8,
    first: [
      "Jakub", "Kamil", "Wojciech", "Karol", "Jan", "Sebastian", "Piotr", "Mateusz",
      "Szymon", "Bartosz", "Michal", "Krzysztof", "Marcin", "Dawid", "Adam", "Adrian",
      "Aleksander", "Andrzej", "Antoni", "Artur", "Damian", "Dariusz", "Filip", "Grzegorz",
      "Igor", "Jacek", "Jerzy", "Kacper", "Konrad", "Lukasz", "Maciej", "Marek",
      "Mariusz", "Oskar", "Pawel", "Przemyslaw", "Rafal", "Robert", "Stanislaw", "Tomasz",
    ],
    last: [
      "Nowak", "Kowalski", "Wisniewski", "Wojcik", "Kowalczyk", "Kaminski", "Szymanski", "Wozniak",
      "Dabrowski", "Kozlowski", "Jankowski", "Mazur", "Krawczyk", "Piotrowski", "Adamczyk", "Andrzejewski",
      "Bak", "Baran", "Borkowski", "Chmielewski", "Czarnecki", "Duda", "Glowacki", "Gorski",
      "Grabowski", "Jablonski", "Jasinski", "Kaczmarek", "Kalinowski", "Kubiak", "Majewski", "Michalak",
      "Nowicki", "Olszewski", "Pawlak", "Sadowski", "Sikora", "Sokolowski", "Stepien", "Szewczyk",
      "Walczak", "Wieczorek", "Witkowski", "Wrobel", "Zajac", "Zalewski", "Zielinski", "Tomaszewski",
    ],
  },
  Ukraine: {
    weight: 8,
    first: [
      "Andriy", "Oleksandr", "Ruslan", "Mykola", "Viktor", "Artem", "Taras", "Yevhen",
      "Denys", "Illia", "Bohdan", "Dmytro", "Maksym", "Vladyslav", "Anatoliy", "Danylo",
      "Ihor", "Ivan", "Kyrylo", "Mykhailo", "Oleh", "Pavlo", "Petro", "Roman",
      "Serhiy", "Stanislav", "Vadym", "Volodymyr",
    ],
    last: [
      "Kovalenko", "Boyko", "Tkachenko", "Kravchenko", "Bondarenko", "Oliynyk", "Shevchuk", "Polishchuk",
      "Lysenko", "Rudenko", "Savchenko", "Melnyk", "Marchenko", "Kovalchuk", "Bondar", "Danylenko",
      "Hrytsenko", "Kharchenko", "Klymenko", "Kostenko", "Kravets", "Lytvyn", "Moroz", "Petrenko",
      "Romanenko", "Sydorenko", "Tymoshenko", "Zhuk",
    ],
  },
  Ghana: {
    weight: 8,
    first: [
      "Kwame", "Kofi", "Kwesi", "Yaw", "Kojo", "Kwabena", "Akwasi", "Nana",
      "Ebenezer", "Prince", "Emmanuel", "Isaac", "Richmond", "Gideon", "Abdul", "Alhassan",
      "Bernard", "Bright", "Clement", "Daniel", "Divine", "Edmund", "Elvis", "Enoch",
      "Ernest", "Evans", "Felix", "Frank", "Godfred", "Ibrahim", "Joseph", "Kelvin",
      "Michael", "Nathaniel", "Patrick", "Samuel", "Selorm", "Solomon", "Stephen", "Kwadwo",
    ],
    last: [
      "Mensah", "Owusu", "Osei", "Boateng", "Asante", "Appiah", "Adjei", "Agyemang",
      "Ofori", "Amoah", "Darko", "Ankrah", "Tetteh", "Quaye", "Aboagye", "Acheampong",
      "Addo", "Adu", "Agyapong", "Amankwah", "Amoako", "Annan", "Anokye", "Antwi",
      "Asamoah", "Baffour", "Bediako", "Danso", "Donkor", "Duah", "Frimpong", "Gyamfi",
      "Kusi", "Nyarko", "Obeng", "Oduro", "Opoku", "Sarpong", "Tagoe", "Yeboah",
    ],
  },
  Serbia: {
    weight: 7,
    first: [
      "Nemanja", "Aleksandar", "Filip", "Luka", "Ivan", "Uros", "Marko", "Nikola",
      "Stefan", "Dusan", "Milos", "Vuk", "Petar", "Lazar", "Andrija", "Bogdan",
      "Bojan", "Boris", "Branislav", "Dejan", "Dragan", "Goran", "Igor", "Jovan",
      "Mihailo", "Milan", "Milorad", "Miroslav", "Nenad", "Ognjen", "Pavle", "Predrag",
      "Sasa", "Slobodan", "Srdjan", "Strahinja", "Vasilije", "Veljko", "Vladimir", "Zoran",
    ],
    last: [
      "Jovanovic", "Petrovic", "Nikolic", "Markovic", "Djordjevic", "Stojanovic", "Stankovic", "Todorovic",
      "Ristic", "Zivkovic", "Lazic", "Vasic", "Simic", "Lukic", "Aleksic", "Antic",
      "Babic", "Bogdanovic", "Cvetkovic", "Dimitrijevic", "Djokic", "Ilic", "Jankovic", "Jeremic",
      "Kostic", "Krstic", "Milic", "Nedeljkovic", "Obradovic", "Pavlovic", "Popovic", "Radovanovic",
      "Stevanovic", "Tomic", "Vucetic", "Vukic", "Zdravkovic", "Milojevic",
    ],
  },
  Cameroon: {
    weight: 7,
    first: [
      "Jean", "Paul", "Pierre", "Serge", "Alain", "Patrick", "Cyrille", "Rodrigue",
      "Landry", "Thierry", "Arnaud", "Blaise", "Herve", "Francis", "Achille", "Armel",
      "Aurelien", "Bertrand", "Boris", "Brice", "Christian", "Clinton", "Didier", "Emile",
      "Eric", "Ernest", "Fabrice", "Franck", "Gaston", "Georges", "Gilbert", "Guy",
      "Joel", "Junior", "Ludovic", "Marcel", "Martial", "Michel", "Narcisse", "Raoul",
    ],
    last: [
      "Mbarga", "Fotso", "Kamga", "Ngono", "Essomba", "Owona", "Atangana", "Etoundi",
      "Mballa", "Ndongo", "Tsafack", "Djoum", "Bekono", "Manga", "Abanda", "Amougou",
      "Ateba", "Bela", "Ebang", "Ekani", "Elong", "Essono", "Eyong", "Fokou",
      "Fongang", "Kemajou", "Kome", "Mbah", "Mbida", "Mengue", "Momo", "Nana",
      "Ndam", "Ndjock", "Njie", "Simo", "Talla", "Tchakounte",
    ],
  },
  "Ivory Coast": {
    weight: 6,
    first: [
      "Jean", "Ibrahim", "Christian", "Didier", "Souleymane", "Mamadou", "Ousmane", "Abdoulaye",
      "Bakary", "Moussa", "Seydou", "Lacina", "Abou", "Aboubacar", "Adama", "Ahmed",
      "Alassane", "Amara", "Aristide", "Armand", "Arsene", "Bruno", "Cedric", "Cheick",
      "Emmanuel", "Eric", "Franck", "Gervais", "Guy", "Hamed", "Herve", "Issouf",
      "Jonathan", "Karim", "Kouadio", "Ladji", "Lassina", "Michel", "Nicolas", "Olivier",
      "Patrice", "Roger", "Salif", "Serge", "Sylvain", "Wilfried", "Yacouba", "Zoumana",
      "Ismael", "Roland", "Sekou", "Vincent",
    ],
    last: [
      "Toure", "Kone", "Ouattara", "Coulibaly", "Diabate", "Kouassi", "Kouame", "Yao",
      "Konan", "Bamba", "Fofana", "Doumbia", "Aka", "Amani", "Assi", "Brou",
      "Diaby", "Diomande", "Dosso", "Kacou", "Koffi", "Kouakou", "Kouyate", "Meite",
      "Nguessan", "Sangare", "Sanogo", "Sylla", "Tanoh", "Traore", "Yapi", "Zoro",
      "Adou", "Angoua", "Beugre", "Dje", "Ehui", "Gohou", "Kanon", "Kobenan",
      "Konate", "Loua", "Nandy", "Obou", "Sekongo", "Soro", "Tape", "Yeo",
    ],
  },
  "United States": {
    weight: 6,
    first: [
      "Tyler", "Brandon", "Austin", "Jake", "Caleb", "Logan", "Mason", "Hunter",
      "Dillon", "Chase", "Cody", "Trevor", "Aidan", "Blake", "Brady", "Bryce",
      "Carson", "Colton", "Connor", "Dalton", "Drew", "Ethan", "Garrett", "Grant",
      "Hayden", "Jared", "Jaxon", "Jordan", "Josh", "Kyle", "Landon", "Levi",
      "Mitchell", "Nolan", "Parker", "Preston", "Riley", "Shane", "Spencer", "Tanner",
    ],
    last: [
      "Miller", "Davis", "Anderson", "Thompson", "Martin", "Garcia", "Martinez", "Hernandez",
      "Jackson", "Brooks", "Sullivan", "Bennett", "Bailey", "Barnes", "Bell", "Bryant",
      "Butler", "Carter", "Coleman", "Cooper", "Cox", "Foster", "Gonzalez", "Gray",
      "Griffin", "Hayes", "Henderson", "Hughes", "Jenkins", "Kelly", "Morgan", "Murphy",
      "Myers", "Nelson", "Perry", "Peterson", "Powell", "Ramirez", "Reed", "Rivera",
      "Ross", "Russell", "Sanders", "Simmons", "Stewart", "Ward", "Watson", "Wright",
    ],
  },
  Switzerland: {
    weight: 5,
    first: [
      "Luca", "Noah", "Leon", "Nico", "Jan", "Fabio", "Silvan", "Joel",
      "Dario", "Marco", "Sandro", "Livio", "Adrian", "Andrin", "Benjamin", "Cedric",
      "Christian", "Daniel", "David", "Elia", "Fabian", "Florian", "Gian", "Gregor",
      "Kevin", "Lars", "Loris", "Lukas", "Manuel", "Mario", "Martin", "Nevio",
      "Pascal", "Patrick", "Remo", "Reto", "Robin", "Simon", "Timo", "Yannick",
    ],
    last: [
      "Meier", "Muller", "Keller", "Huber", "Schneider", "Weber", "Baumann", "Frei",
      "Brunner", "Steiner", "Widmer", "Bianchi", "Ackermann", "Berger", "Bosshard", "Burri",
      "Egger", "Fischer", "Furrer", "Gerber", "Graf", "Gut", "Hofer", "Hug",
      "Kaufmann", "Koch", "Lehmann", "Lutz", "Marti", "Moser", "Roth", "Schmid",
      "Sigrist", "Studer", "Suter", "Tanner", "Vogel", "Wenger", "Zeller", "Zuber",
    ],
  },
  Japan: {
    weight: 5,
    first: [
      "Haruto", "Yuto", "Sota", "Ren", "Kaito", "Daiki", "Riku", "Kenta",
      "Shota", "Yuki", "Hiroto", "Kazuki", "Aoi", "Asahi", "Daichi", "Eiji",
      "Fuma", "Hayato", "Hinata", "Ichiro", "Jun", "Kaede", "Keita", "Kenji",
      "Kosei", "Makoto", "Masaki", "Naoki", "Ryo", "Ryota", "Satoshi", "Sho",
      "Sora", "Taiga", "Takumi", "Tatsuya", "Tomoya", "Yamato", "Yusuke", "Yuya",
    ],
    last: [
      "Sato", "Suzuki", "Takahashi", "Tanaka", "Watanabe", "Yamamoto", "Nakamura", "Kobayashi",
      "Kato", "Yoshida", "Yamada", "Sasaki", "Abe", "Aoki", "Fujii", "Fujita",
      "Goto", "Hasegawa", "Hayashi", "Ikeda", "Inoue", "Ishii", "Ito", "Kimura",
      "Kondo", "Maeda", "Matsumoto", "Mori", "Murakami", "Nakajima", "Ogawa", "Okada",
      "Ono", "Saito", "Sakamoto", "Shimizu", "Takeda", "Ueda", "Yamaguchi", "Yamashita",
    ],
  },
  "South Korea": {
    weight: 5,
    first: [
      "Min-jun", "Ji-hoon", "Dong-hyun", "Hyun-woo", "Ji-ho", "Jun-seo", "Seung-min", "Woo-jin",
      "Tae-yang", "Ye-jun", "Do-yun", "Si-woo", "Dong-wook", "Hyun-jun", "Jae-min", "Jin-woo",
      "Joon-ho", "Ji-woo", "Kyung-ho", "Min-seok", "Sang-hyun", "Seo-jun", "Sung-min", "Yoon-ho",
    ],
    last: [
      "Kim", "Lee", "Park", "Choi", "Jung", "Kang", "Cho", "Yoon",
      "Jang", "Lim", "Han", "Oh", "Ahn", "Bae", "Hong", "Hwang",
      "Jeon", "Ko", "Kwon", "Moon", "Nam", "Seo", "Shin", "Song",
    ],
  },
  Austria: {
    weight: 4,
    first: [
      "Lukas", "Tobias", "Florian", "Simon", "Elias", "Julian", "Matthias", "Paul",
      "Jonas", "Felix", "Alexander", "Andreas", "Christoph", "Clemens", "Daniel", "David",
      "Dominik", "Fabian", "Gernot", "Hannes", "Johannes", "Josef", "Klaus", "Konrad",
      "Leopold", "Manuel", "Markus", "Martin", "Michael", "Patrick", "Philipp", "Rainer",
      "Sebastian", "Stefan", "Thomas", "Valentin", "Werner", "Wolfgang",
    ],
    last: [
      "Gruber", "Huber", "Bauer", "Wagner", "Pichler", "Steiner", "Moser", "Mayer",
      "Hofer", "Leitner", "Aigner", "Berger", "Brunner", "Ebner", "Eder", "Egger",
      "Fuchs", "Haas", "Haider", "Hofmann", "Holzer", "Kern", "Koller", "Lang",
      "Lechner", "Maier", "Neubauer", "Pfeifer", "Reiter", "Riegler", "Schmid", "Schwarz",
      "Stadler", "Wallner", "Weber", "Wimmer", "Winkler", "Zeller",
    ],
  },
  "Czech Republic": {
    weight: 4,
    first: [
      "Jan", "Jakub", "Tomas", "Adam", "Matej", "Ondrej", "Filip", "Vojtech",
      "Dominik", "Lukas", "Daniel", "David", "Jaroslav", "Jiri", "Josef", "Karel",
      "Marek", "Martin", "Michal", "Milan", "Miroslav", "Patrik", "Pavel", "Petr",
      "Radek", "Roman", "Vaclav", "Zdenek",
    ],
    last: [
      "Novak", "Svoboda", "Novotny", "Dvorak", "Cerny", "Prochazka", "Kucera", "Vesely",
      "Horak", "Nemec", "Benes", "Blazek", "Cermak", "Dolezal", "Fiala", "Havlicek",
      "Kolar", "Kopecky", "Kral", "Mares", "Pokorny", "Pospisil", "Ruzicka", "Sedlacek",
      "Simek", "Stastny", "Urban", "Vlcek",
    ],
  },
  Turkey: {
    weight: 4,
    first: [
      "Emre", "Mert", "Can", "Efe", "Yusuf", "Ahmet", "Mehmet", "Mustafa",
      "Umut", "Berkay", "Burak", "Serkan", "Onur", "Kaan", "Deniz", "Baris",
      "Cem", "Kerem", "Eren", "Arda", "Ali", "Hasan", "Huseyin", "Ibrahim",
      "Ismail", "Osman", "Murat", "Fatih", "Halil", "Ramazan", "Recep", "Suleyman",
      "Yasin", "Bilal", "Furkan", "Enes", "Emirhan", "Kadir", "Okan", "Sinan",
      "Tolga", "Tarik", "Volkan", "Yigit", "Alper", "Aykut", "Bugra", "Caner",
      "Cihan", "Ertugrul", "Ferhat", "Gokhan", "Hakan", "Ilker", "Kemal", "Levent",
      "Metin", "Oguz", "Ozan", "Sercan", "Selim", "Semih", "Taner", "Tugay",
      "Ugur", "Veli", "Yavuz", "Zafer", "Abdullah", "Adem", "Alican", "Batuhan",
      "Berat", "Berk", "Cagatay", "Dogukan", "Ekrem", "Emin", "Ercan", "Erdem",
      "Erkan", "Ferdi", "Gokay", "Hamza", "Harun", "Ilhan", "Kagan", "Koray",
      "Orhan", "Salih", "Sefa", "Serdar", "Tayfun", "Yakup",
    ],
    last: [
      "Yilmaz", "Kaya", "Demir", "Celik", "Sahin", "Yildirim", "Ozturk", "Aydin",
      "Arslan", "Dogan", "Kilic", "Aslan", "Cetin", "Kara", "Koc", "Kurt",
      "Ozdemir", "Simsek", "Korkmaz", "Ozkan", "Yildiz", "Sen", "Bulut", "Avci",
      "Aksoy", "Tekin", "Kaplan", "Duman", "Ates", "Bozkurt", "Cinar", "Uysal",
      "Tas", "Gunes", "Akbas", "Karaca", "Sari", "Kocak", "Bilgin", "Yalcin",
      "Sezer", "Yucel", "Ozer", "Balci", "Guven", "Cakir", "Bayram", "Altun",
      "Basaran", "Coskun", "Demirci", "Dinc", "Erol", "Genc", "Gul", "Kahraman",
      "Karabulut", "Kartal", "Keskin", "Kilinc", "Kose", "Kucuk", "Mutlu", "Oz",
      "Ozbek", "Ozgur", "Saglam", "Sanli", "Savas", "Sonmez", "Soylu", "Tan",
      "Tunc", "Ucar", "Ulusoy", "Unal", "Uzun", "Varol", "Yaman", "Yesil",
      "Yorulmaz", "Akgul", "Bal", "Cakmak", "Elmas", "Ergin", "Fidan", "Guzel",
      "Kandemir", "Ozsoy", "Sarikaya", "Tuncel", "Akyol", "Bayrak", "Dursun", "Turgut",
    ],
  },
  Algeria: {
    weight: 3,
    first: [
      "Mohamed", "Amine", "Yacine", "Sofiane", "Bilal", "Walid", "Karim", "Rayan",
      "Adel", "Farid", "Abdelkader", "Ahmed", "Ali", "Anis", "Bachir", "Brahim",
      "Djamel", "Fares", "Hamza", "Hicham", "Ilyes", "Islam", "Ismail", "Kamel",
      "Khaled", "Lounis", "Mahdi", "Mehdi", "Mourad", "Nabil", "Nadir", "Omar",
      "Rachid", "Reda", "Redouane", "Riad", "Sami", "Samir", "Tarek", "Youcef",
    ],
    last: [
      "Benali", "Bouazza", "Cherif", "Hamdi", "Meziane", "Belkacem", "Saadi", "Mansouri",
      "Kaci", "Djebbar", "Abdelli", "Aissaoui", "Amrani", "Belaid", "Belhadj", "Benamara",
      "Benmoussa", "Bensalah", "Berkane", "Boudiaf", "Boukhalfa", "Boumediene", "Chaib", "Dahmani",
      "Guendouz", "Haddad", "Kadri", "Khelifi", "Lakhdar", "Larbi", "Madani", "Mebarki",
      "Mokhtari", "Ouali", "Rahmani", "Taleb", "Yahia", "Ziani",
    ],
  },
  Morocco: {
    weight: 3,
    first: [
      "Mohamed", "Youssef", "Omar", "Anas", "Hamza", "Ayoub", "Zakaria", "Ilias",
      "Reda", "Badr", "Abdellah", "Abderrahim", "Adam", "Adil", "Ahmed", "Amine",
      "Anouar", "Aymane", "Bilal", "Brahim", "Driss", "Fouad", "Hakim", "Hamid",
      "Hassan", "Hicham", "Ibrahim", "Idriss", "Ismail", "Jamal", "Karim", "Khalid",
      "Marouane", "Mehdi", "Mounir", "Mourad", "Nabil", "Oussama", "Rachid", "Redouane",
      "Said", "Salim", "Samir", "Sofiane", "Soufiane", "Tarik", "Walid", "Yassine",
      "Younes", "Zouhair", "Nordine", "Rida",
    ],
    last: [
      "Alaoui", "Benjelloun", "El Amrani", "Tazi", "Berrada", "Chraibi", "El Idrissi", "Bennani",
      "Lahlou", "Sebti", "Abdellaoui", "Amrani", "Belhaj", "Bennis", "Boukhari", "Bouzid",
      "Chakir", "Cherkaoui", "Daoudi", "El Fassi", "El Khattabi", "El Mansouri", "Ennaji", "Essaidi",
      "Ghali", "Hajji", "Hamdaoui", "Idrissi", "Kabbaj", "Karimi", "Lamrani", "Marzouki",
      "Mekouar", "Naciri", "Ouazzani", "Rachidi", "Saidi", "Sekkat", "Slaoui", "Tahiri",
      "Tounsi", "Zaidi", "Zeroual", "Benkirane", "Bourkia", "El Ouafi", "Hilali", "Jebbour",
      "Moujahid", "Nassiri", "Sabri", "Talbi",
    ],
  },
  Senegal: {
    weight: 3,
    first: [
      "Mamadou", "Ousmane", "Abdoulaye", "Cheikh", "Ibrahima", "Modou", "Pape", "Serigne",
      "Aliou", "Babacar", "Alioune", "Amadou", "Assane", "Bacary", "Baye", "Bocar",
      "Boubacar", "Daouda", "Demba", "Djibril", "El Hadji", "Fallou", "Falilou", "Gora",
      "Habib", "Ibou", "Idrissa", "Insa", "Issa", "Khadim", "Lamine", "Malick",
      "Mansour", "Massamba", "Moctar", "Mouhamed", "Moussa", "Moustapha", "Ndiaga", "Omar",
      "Ousseynou", "Pathe", "Saliou", "Samba", "Seydou", "Sidy", "Souleymane", "Tapha",
      "Thierno", "Waly", "Yankhoba", "Youssou",
    ],
    last: [
      "Ndiaye", "Diop", "Fall", "Gueye", "Sy", "Ba", "Faye", "Sarr",
      "Niang", "Diouf", "Cisse", "Mbaye", "Seck", "Thiam", "Sow", "Camara",
      "Diallo", "Sane", "Ndoye", "Badji", "Coly", "Diatta", "Goudiaby", "Samb",
      "Tine", "Dieng", "Diagne", "Kane", "Wade", "Balde", "Diedhiou", "Ndao",
      "Mendy", "Sonko", "Toure", "Traore", "Ka", "Lo", "Gaye", "Bakhoum",
      "Sembene", "Dabo", "Boye", "Ndir", "Diack", "Mbengue", "Basse", "Ndour",
      "Ngom", "Sagna",
    ],
  },
  Mexico: {
    weight: 3,
    first: [
      "Jose", "Luis", "Juan", "Carlos", "Jorge", "Miguel", "Fernando", "Ricardo",
      "Eduardo", "Alejandro", "Angel", "Antonio", "Cesar", "Daniel", "Diego", "Emiliano",
      "Francisco", "Gerardo", "Hector", "Javier", "Manuel", "Oscar", "Pedro", "Sergio",
    ],
    last: [
      "Hernandez", "Garcia", "Martinez", "Lopez", "Gonzalez", "Rodriguez", "Sanchez", "Ramirez",
      "Cruz", "Vargas", "Aguilar", "Alvarado", "Bautista", "Castaneda", "Chavez", "Contreras",
      "Delgado", "Espinoza", "Guzman", "Juarez", "Mendoza", "Ortega", "Reyes", "Rosales",
    ],
  },
  Canada: {
    weight: 2,
    first: [
      "Liam", "Ethan", "Noah", "Owen", "Lucas", "Nathan", "Cole", "Carter",
      "Evan", "Tristan", "Alexandre", "Andrew", "Benjamin", "Braden", "Connor", "Dylan",
      "Felix", "Gabriel", "Jacob", "Mathieu", "Nolan", "Ryan", "Samuel", "Zachary",
    ],
    last: [
      "Tremblay", "Roy", "Gagnon", "MacLeod", "Fraser", "Bouchard", "Cote", "Morin",
      "Leblanc", "Ross", "Beaulieu", "Bergeron", "Campbell", "Cloutier", "Desjardins", "Gauthier",
      "Girard", "Lavoie", "Lefebvre", "Levesque", "Ouellet", "Paquette", "Pelletier", "Thibault",
    ],
  },
  Australia: {
    weight: 2,
    first: [
      "Lachlan", "Cooper", "Riley", "Mitchell", "Brayden", "Zac", "Jayden", "Flynn",
      "Bailey", "Angus", "Archie", "Beau", "Callum", "Darcy", "Declan", "Ethan",
      "Hamish", "Harrison", "Jarrod", "Kai", "Liam", "Oscar", "Toby", "Xavier",
    ],
    last: [
      "Kennedy", "O'Neill", "Marsh", "Hughes", "Fitzgerald", "Watson", "Nash", "Payne",
      "Draper", "Sutton", "Barrett", "Cameron", "Cross", "Doyle", "Ferguson", "Gallagher",
      "Hayward", "Lucas", "Mackay", "Newman", "Pratt", "Quinn", "Rankin", "Whitfield",
    ],
  },
  Finland: {
    weight: 2,
    first: [
      "Onni", "Eetu", "Aleksi", "Ville", "Juho", "Niko", "Samu", "Arttu",
      "Joona", "Elias", "Antti", "Eero", "Emil", "Henri", "Jaakko", "Janne",
      "Jere", "Joel", "Kalle", "Lauri", "Matias", "Mikko", "Otto", "Rasmus",
    ],
    last: [
      "Korhonen", "Virtanen", "Makinen", "Nieminen", "Hamalainen", "Laine", "Heikkinen", "Koskinen",
      "Jarvinen", "Lehtonen", "Aalto", "Ahonen", "Halonen", "Hiltunen", "Kallio", "Karjalainen",
      "Lahti", "Leppanen", "Mattila", "Ojala", "Rantanen", "Saarinen", "Salminen", "Turunen",
    ],
  },
  Romania: {
    weight: 2,
    first: [
      "Andrei", "Alexandru", "Stefan", "Mihai", "Ionut", "Gabriel", "Vlad", "Darius",
      "Razvan", "Cristian", "Adrian", "Bogdan", "Catalin", "Ciprian", "Constantin", "Cosmin",
      "Daniel", "Denis", "Dragos", "Florin", "George", "Ion", "Iulian", "Marian",
      "Marius", "Nicolae", "Octavian", "Paul", "Sorin", "Valentin", "Victor", "Silviu",
    ],
    last: [
      "Popescu", "Ionescu", "Popa", "Radu", "Dumitrescu", "Stan", "Stoica", "Munteanu",
      "Gheorghe", "Matei", "Barbu", "Constantinescu", "Cristea", "Diaconu", "Dinu", "Dobre",
      "Dumitru", "Enache", "Florea", "Georgescu", "Iancu", "Lazar", "Marin", "Mihailescu",
      "Neagu", "Nistor", "Oprea", "Petrescu", "Sandu", "Tudor", "Vasile", "Voicu",
    ],
  },
  Slovakia: {
    weight: 2,
    first: [
      "Martin", "Tomas", "Peter", "Michal", "Jakub", "Lukas", "Matus", "Samuel",
      "Adam", "Filip", "Andrej", "Dominik", "Erik", "Jan", "Juraj", "Marek",
      "Marian", "Milan", "Miroslav", "Patrik", "Pavol", "Rastislav", "Stanislav", "Vladimir",
    ],
    last: [
      "Kovac", "Horvath", "Varga", "Toth", "Nagy", "Balaz", "Molnar", "Szabo",
      "Lukac", "Polak", "Baran", "Benko", "Gajdos", "Hudec", "Kollar", "Kral",
      "Krajci", "Lehotsky", "Mikula", "Novotny", "Ondrus", "Sedlak", "Simko", "Vlk",
    ],
  },
  Slovenia: {
    weight: 2,
    first: [
      "Luka", "Jan", "Nejc", "Ziga", "Anze", "Tilen", "Gasper", "Rok",
      "Blaz", "Matic", "Aljaz", "Andraz", "David", "Domen", "Gregor", "Jaka",
      "Jure", "Klemen", "Marko", "Matej", "Miha", "Nik", "Primoz", "Tim",
    ],
    last: [
      "Novak", "Horvat", "Krajnc", "Zupancic", "Potocnik", "Kovac", "Mlakar", "Vidmar",
      "Golob", "Turk", "Bizjak", "Bregar", "Cerar", "Hribar", "Jerman", "Kavcic",
      "Kos", "Kotnik", "Lesjak", "Pavlin", "Rozman", "Sever", "Zajc", "Zupan",
    ],
  },
  Iceland: {
    weight: 2,
    first: [
      "Jon", "Gunnar", "Bjarni", "Kristjan", "Olafur", "Einar", "Magnus", "Arnar",
      "Dagur", "Haukur", "Andri", "Ari", "Baldur", "Birkir", "Egill", "Elvar",
      "Finnur", "Gudmundur", "Hallgrimur", "Ingi", "Kari", "Sigurdur", "Stefan", "Thorir",
    ],
    last: [
      "Jonsson", "Gunnarsson", "Einarsson", "Magnusson", "Olafsson", "Kristjansson", "Arnarsson", "Thorsteinsson",
      "Halldorsson", "Palsson", "Arnason", "Bjarnason", "Danielsson", "Eiriksson", "Gislason", "Gudjonsson",
      "Hafsteinsson", "Helgason", "Ingason", "Karlsson", "Petursson", "Sigurdsson", "Stefansson", "Thorarinsson",
    ],
  },
  Mali: {
    weight: 2,
    first: [
      "Moussa", "Amadou", "Boubacar", "Cheick", "Seydou", "Modibo", "Souleymane", "Adama",
      "Drissa", "Mamadou", "Abdoulaye", "Alou", "Aly", "Bakary", "Bandiougou", "Bourama",
      "Daouda", "Fousseni", "Hamidou", "Ibrahim", "Issa", "Kalifa", "Karim", "Lassana",
      "Mahamadou", "Mamady", "Moctar", "Ousmane", "Salif", "Sekou", "Sidiki", "Sory",
      "Tidiane", "Yacouba", "Yaya", "Youssouf",
    ],
    last: [
      "Traore", "Coulibaly", "Keita", "Diarra", "Sidibe", "Kone", "Doumbia", "Diallo",
      "Camara", "Sanogo", "Bagayoko", "Ballo", "Berthe", "Cisse", "Diakite", "Dicko",
      "Dolo", "Fane", "Fofana", "Guindo", "Haidara", "Kamissoko", "Konate", "Kouyate",
      "Maiga", "Malle", "Niare", "Samake", "Sangare", "Sissoko", "Sow", "Tangara",
      "Togola", "Toure", "Diakhate", "Sacko",
    ],
  },
  "Burkina Faso": {
    weight: 1,
    first: [
      "Issa", "Adama", "Boureima", "Salif", "Idrissa", "Harouna", "Karim", "Zakaria",
      "Abdoul", "Alassane", "Aristide", "Bakary", "Bertrand", "Cyrille", "Drissa", "Hamado",
      "Herve", "Ibrahim", "Lassina", "Moussa", "Ousmane", "Rasmane", "Seydou", "Wilfried",
    ],
    last: [
      "Ouedraogo", "Kabore", "Sawadogo", "Zongo", "Compaore", "Nikiema", "Sanou", "Ilboudo",
      "Bado", "Bamogo", "Bance", "Dabire", "Derme", "Kagone", "Kambou", "Kanazoe",
      "Konfe", "Nacoulma", "Ouattara", "Sanfo", "Sankara", "Tapsoba", "Traore", "Yameogo",
    ],
  },
  "DR Congo": {
    weight: 1,
    first: [
      "Cedric", "Yannick", "Gael", "Jonathan", "Patrick", "Christian", "Glody", "Dieudonne",
      "Alain", "Arsene", "Bienvenu", "Blaise", "Cesar", "Clement", "Deo", "Elie",
      "Emmanuel", "Fabrice", "Firmin", "Franck", "Gedeon", "Herve", "Jacques", "Joel",
      "Junior", "Landry", "Marcel", "Merveille", "Nathan", "Papy", "Prince", "Tresor",
    ],
    last: [
      "Kabongo", "Ilunga", "Mukendi", "Tshibanda", "Kalonji", "Mbuyi", "Ngoy", "Kasongo",
      "Badibanga", "Bwanga", "Kabamba", "Kabuya", "Kalala", "Kalombo", "Kambala", "Kanda",
      "Kanku", "Kapinga", "Kayembe", "Lubamba", "Lumbu", "Mbala", "Mbombo", "Muamba",
      "Mulumba", "Mutombo", "Mwamba", "Ndaye", "Ngandu", "Ntumba", "Tshibola", "Tshimanga",
    ],
  },
  Guinea: {
    weight: 1,
    first: [
      "Mohamed", "Ibrahima", "Ousmane", "Sekou", "Alseny", "Mamadi", "Fode", "Lansana",
      "Abdoulaye", "Alhassane", "Aly", "Amadou", "Boubacar", "Cheick", "Djibril", "El Hadj",
      "Ismael", "Mamadou", "Mory", "Moussa", "Saliou", "Sekouba", "Souleymane", "Thierno",
      "Yacouba", "Aboubacar", "Facinet", "Karamoko",
    ],
    last: [
      "Camara", "Sylla", "Bah", "Barry", "Conde", "Soumah", "Cisse", "Toure",
      "Bangoura", "Bangura", "Balde", "Conte", "Diakite", "Diallo", "Diane", "Doumbouya",
      "Fofana", "Kaba", "Keita", "Kourouma", "Mara", "Savane", "Sidibe", "Sow",
      "Souare", "Traore", "Yansane", "Doumbia",
    ],
  },
  Uruguay: {
    weight: 1,
    first: [
      "Santiago", "Matias", "Agustin", "Facundo", "Diego", "Bruno", "Emiliano", "Maximiliano",
      "Alejandro", "Alvaro", "Andres", "Bautista", "Camilo", "Carlos", "Cristian", "Damian",
      "Enzo", "Fabian", "Federico", "Felipe", "Fernando", "Gaston", "Gonzalo", "Guillermo",
      "Gustavo", "Ignacio", "Joaquin", "Juan", "Leandro", "Lucas", "Marcelo", "Martin",
      "Mauricio", "Nicolas", "Pablo", "Rodrigo", "Sebastian", "Tomas",
    ],
    last: [
      "Perez", "Rodriguez", "Fernandez", "Gonzalez", "Silva", "Pereira", "Sosa", "Techera",
      "Acosta", "Alonso", "Alvarez", "Barrios", "Benitez", "Cabrera", "Castro", "Correa",
      "De Leon", "Diaz", "Duarte", "Garcia", "Gimenez", "Gomez", "Hernandez", "Lopez",
      "Machado", "Martinez", "Medina", "Mendez", "Olivera", "Ortiz", "Ramos", "Rivero",
      "Romero", "Sanchez", "Torres", "Vazquez", "Vera", "Viera",
    ],
  },
  Colombia: {
    weight: 1,
    first: [
      "Juan", "Camilo", "Andres", "Santiago", "Sebastian", "Mateo", "Daniel", "Felipe",
      "Alejandro", "Carlos", "Cristian", "David", "Diego", "Edwin", "Esteban", "Fabian",
      "Jhon", "Jorge", "Julian", "Luis", "Miguel", "Nicolas", "Oscar", "Ricardo",
      "Samuel", "Sergio", "Wilmar", "Yeison",
    ],
    last: [
      "Gomez", "Restrepo", "Cardona", "Arango", "Betancur", "Salazar", "Castano", "Giraldo",
      "Acevedo", "Agudelo", "Arias", "Bedoya", "Bolanos", "Cadavid", "Correa", "Duque",
      "Escobar", "Franco", "Guerrero", "Hoyos", "Jaramillo", "Marulanda", "Mejia", "Montoya",
      "Osorio", "Palacio", "Quintero", "Rincon",
    ],
  },
  Ecuador: {
    weight: 1,
    first: [
      "Carlos", "Luis", "Angel", "Jefferson", "Bryan", "Kevin", "Jhon", "Darwin",
      "Alexander", "Anderson", "Byron", "Cristian", "Damian", "Diego", "Edison", "Fernando",
      "Jaime", "Joao", "Jordy", "Jose", "Marcos", "Michael", "Patricio", "Renato",
      "Ronny", "Segundo", "Washington", "Wilson",
    ],
    last: [
      "Zambrano", "Cedeno", "Mendez", "Quinonez", "Vera", "Espinoza", "Palacios", "Chila",
      "Andrade", "Arroyo", "Bone", "Carabali", "Castillo", "Cortez", "Delgado", "Guerrero",
      "Intriago", "Mina", "Montano", "Moreira", "Ordonez", "Preciado", "Solis", "Tenorio",
      "Vergara", "Zamora", "Angulo", "Bravo",
    ],
  },
  Paraguay: {
    weight: 1,
    first: [
      "Oscar", "Victor", "Hugo", "Cesar", "Ruben", "Osvaldo", "Blas", "Adalberto",
      "Alejandro", "Antonio", "Braian", "Carlos", "Derlis", "Diego", "Fabian", "Gustavo",
      "Ivan", "Jorge", "Julio", "Luis", "Marcelo", "Nelson", "Robert", "Rodrigo",
    ],
    last: [
      "Benitez", "Caceres", "Villalba", "Ayala", "Franco", "Ortiz", "Riveros", "Ruiz Diaz",
      "Aquino", "Barrios", "Bobadilla", "Cabral", "Duarte", "Escobar", "Gimenez", "Gonzalez",
      "Ledesma", "Lezcano", "Martinez", "Mendoza", "Morel", "Ovelar", "Paredes", "Samudio",
    ],
  },
  Venezuela: {
    weight: 1,
    first: [
      "Jose", "Miguel", "Rafael", "Alejandro", "Jesus", "Eduardo", "Anthony", "Jhonny",
      "Alexander", "Angel", "Carlos", "Daniel", "Darwin", "Edgar", "Franklin", "Gabriel",
      "Jefferson", "Jhon", "Juan", "Luis", "Manuel", "Ricardo", "Ronald", "Wilker",
    ],
    last: [
      "Blanco", "Castillo", "Rivas", "Guerra", "Paez", "Mendoza", "Colmenares", "Aponte",
      "Alvarado", "Arteaga", "Bello", "Bermudez", "Contreras", "Escalante", "Figuera", "Gil",
      "Hidalgo", "Lozano", "Marquez", "Montes", "Ortega", "Quintero", "Rojas", "Suarez",
    ],
  },
};

/**
 * A staging table for nationalities that have a full name pool and a "home
 * league" weight, but are deliberately excluded from NATIONALITIES (and
 * therefore from totalWeight()/pickFromTable's flat, no-homeCountry draw): a
 * nation placed here can only ever be drawn via
 * pickNationality(rng, homeCountry) with that exact homeCountry — never as
 * incidental flavor in another league's roster, and never in the flat pool
 * every existing save's youth intake/free agency already relies on. This
 * keeps adding a new nationality from silently shifting the outcome
 * distribution for saves that have nothing to do with it. Graduate an entry
 * to NATIONALITIES once its home league actually exists in every save it
 * could appear in.
 *
 * Italy lived here while its home league was newer than some saves, and was
 * graduated into NATIONALITIES once every world generated an Italian league —
 * so Italians now appear abroad as ordinary foreign flavor, like Spaniards and
 * Germans.
 *
 * The current residents arrived with the Turkish league: the Super Lig's real
 * breakdown has a distinctive Balkan/West-African tail that names three nations
 * with no pool anywhere. They sit here rather than in OTHER_NATIONS on purpose
 * — TAIL_BASE is built from NATIONALITIES + OTHER_NATIONS only, so putting them
 * there would have re-weighted the "Rest of the World" tail draw for every
 * league in every existing save. Here they can only ever be drawn by the
 * Turkish table that names them explicitly. The `weight` is unused for these
 * (nothing reads UNLISTED for a flat draw); it records where they would sit if
 * they were ever graduated.
 */
export const UNLISTED_NATIONALITIES: Record<string, NationalityDef> = {
  "Bosnia-Herzegovina": {
    weight: 3,
    first: [
      "Amar", "Haris", "Emir", "Tarik", "Adnan", "Vedad", "Miralem", "Denis",
      "Armin", "Edin", "Adis", "Alen", "Almir", "Amel", "Anel", "Damir",
      "Dino", "Elvis", "Ermin", "Faruk", "Jasmin", "Kenan", "Mirza", "Nedim",
      "Nermin", "Samir", "Senad", "Adem",
    ],
    last: [
      "Hodzic", "Begic", "Delic", "Mujic", "Salihovic", "Kovacevic", "Halilovic", "Suljic",
      "Music", "Alic", "Avdic", "Bajramovic", "Beganovic", "Dedic", "Ferhatovic", "Hadzic",
      "Husic", "Imamovic", "Jusic", "Karic", "Mehmedovic", "Omerovic", "Osmanovic", "Ramic",
      "Sarajlic", "Softic", "Tahirovic", "Zukic",
    ],
  },
  Gambia: {
    weight: 2,
    first: [
      "Lamin", "Modou", "Ebrima", "Musa", "Alieu", "Ousman", "Sulayman", "Momodou",
      "Bakary", "Yankuba", "Abdoulie", "Amadou", "Assan", "Buba", "Dawda", "Foday",
      "Ismaila", "Kebba", "Malick", "Muhammed", "Omar", "Pa", "Saikou", "Sanna",
    ],
    last: [
      "Jallow", "Ceesay", "Touray", "Sanneh", "Bojang", "Darboe", "Camara", "Njie",
      "Sowe", "Manneh", "Badjie", "Bah", "Colley", "Conteh", "Danso", "Drammeh",
      "Fatty", "Jammeh", "Janneh", "Jarju", "Jatta", "Jobe", "Kanteh", "Sillah",
    ],
  },
  Albania: {
    weight: 3,
    first: [
      "Arber", "Endrit", "Klevis", "Ardit", "Redon", "Kristi", "Erjon", "Fatjon",
      "Blerim", "Gentian", "Albion", "Altin", "Andi", "Arlind", "Armando", "Besnik",
      "Denis", "Dorian", "Elton", "Enea", "Ermal", "Florian", "Ilir", "Kreshnik",
      "Lorik", "Sokol", "Erion", "Klodian",
    ],
    last: [
      "Hoxha", "Shehu", "Krasniqi", "Berisha", "Gjoka", "Prifti", "Bardhi", "Leka",
      "Zeneli", "Malaj", "Ahmeti", "Bala", "Bregu", "Cela", "Dedaj", "Dema",
      "Duka", "Gjini", "Hasani", "Kola", "Kurti", "Lala", "Marku", "Meta",
      "Muca", "Nika", "Rama", "Vata",
    ],
  },

  /* ── Reachable only by a league that names them (2026-08-26) ──────────────
   * Everything below exists so a league the player builds can be somewhere in
   * particular: a Gulf league, an east African one, an Oceanian one. They are
   * here rather than in OTHER_NATIONS for the reason this table exists at all
   * — TAIL_BASE is built from NATIONALITIES + OTHER_NATIONS, so adding thirty
   * nations there would re-weight the "Rest of the World" tail of every league
   * in every existing save. Here they are drawn only by a table that names
   * them explicitly, so the shipped world is untouched.
   *
   * `weight` is unused for UNLISTED entries (nothing reads it for a flat draw);
   * it records where they would sit if one were ever graduated.
   *
   * Names are common civilian ones, never national-team squads, so a generated
   * player can't read as a real professional. Several have no flag art yet and
   * render the neutral swatch <Flag> already falls back to. */
  "Saudi Arabia": {
    weight: 2,
    first: [
      "Abdullah", "Mohammed", "Faisal", "Khalid", "Saud", "Turki", "Nasser", "Bandar",
      "Majed", "Sultan", "Fahad", "Yousef", "Omar", "Ibrahim", "Salman", "Rayan",
      "Ziyad", "Hatim", "Anas", "Marwan", "Talal", "Waleed", "Rakan", "Badr",
    ],
    last: [
      "Alharbi", "Alotaibi", "Alqahtani", "Alghamdi", "Alzahrani", "Alshehri", "Aldosari", "Almutairi",
      "Alanazi", "Alsubaie", "Alamri", "Albalawi", "Alrashidi", "Aljuhani", "Alshammari", "Alfaifi",
      "Alyami", "Alkhaldi", "Alsulami", "Alhazmi", "Almalki", "Asiri", "Bahammam", "Nahdi",
    ],
  },
  Qatar: {
    weight: 2,
    first: [
      "Hassan", "Ali", "Ahmad", "Jassim", "Nasser", "Khalid", "Saad", "Hamad",
      "Tamim", "Rashid", "Mubarak", "Fahad", "Yousef", "Mansour", "Salem", "Ismail",
      "Zayed", "Ghanim", "Talal", "Bilal", "Karim", "Adel", "Waleed", "Sultan",
    ],
    last: [
      "Almarri", "Alsulaiti", "Alnaimi", "Albinali", "Alyazidi", "Alhajri", "Alemadi", "Almeer",
      "Alrumaihi", "Alshahwani", "Almansoori", "Alobaidly", "Alkubaisi", "Aljabri", "Alsada", "Alnuaimi",
      "Almohammed", "Alsalem", "Alkhater", "Almadadi", "Alkaabi", "Alboainin", "Aldarwish", "Alfardan",
    ],
  },
  "United Arab Emirates": {
    weight: 2,
    first: [
      "Khalifa", "Zayed", "Saeed", "Ahmed", "Mohammed", "Rashid", "Obaid", "Sultan",
      "Hamdan", "Majid", "Saif", "Ali", "Abdulrahman", "Hazza", "Tariq", "Yaqoub",
      "Ismail", "Salem", "Nasser", "Fares", "Adel", "Marwan", "Omar", "Jassem",
    ],
    last: [
      "Almarzooqi", "Alhammadi", "Alshamsi", "Almenhali", "Alblooshi", "Alnaqbi", "Alzaabi", "Alketbi",
      "Alraisi", "Almazrouei", "Alsuwaidi", "Alqubaisi", "Alhosani", "Aldhaheri", "Alameri", "Alyammahi",
      "Alnuaimi", "Alsaadi", "Alfalasi", "Alrahoumi", "Almulla", "Alderei", "Albreiki", "Alhefeiti",
    ],
  },
  Iraq: {
    weight: 2,
    first: [
      "Ali", "Hussein", "Mustafa", "Ahmed", "Karrar", "Bashar", "Hayder", "Mahmoud",
      "Saif", "Kadhim", "Rebin", "Amjad", "Alaa", "Ammar", "Ibrahim", "Zaid",
      "Sajjad", "Wissam", "Younis", "Firas", "Rashid", "Osama", "Muntadher", "Salam",
    ],
    last: [
      "Alhasan", "Almousawi", "Alkhafaji", "Aljanabi", "Altamimi", "Alobaidi", "Alsaadi", "Alrubaie",
      "Alzubaidi", "Aldulaimi", "Alkaabi", "Alshammari", "Almaliki", "Alhamdani", "Alazzawi", "Alnasiri",
      "Barzani", "Rasheed", "Jassim", "Sabri", "Hameed", "Fadhil", "Yaseen", "Shakir",
    ],
  },
  Uzbekistan: {
    weight: 2,
    first: [
      "Jasur", "Otabek", "Sardor", "Bekzod", "Azizbek", "Timur", "Rustam", "Doston",
      "Javohir", "Shohruh", "Bobur", "Alisher", "Farrukh", "Islom", "Sanjar", "Ulugbek",
      "Dilshod", "Aziz", "Nodir", "Eldor", "Kamron", "Anvar", "Muhammadali", "Sherzod",
    ],
    last: [
      "Karimov", "Yusupov", "Rakhimov", "Ergashev", "Nazarov", "Tursunov", "Ibragimov", "Sharipov",
      "Juraev", "Umarov", "Saidov", "Alimov", "Kholmatov", "Rashidov", "Sultanov", "Mirzaev",
      "Abdullaev", "Toshmatov", "Qodirov", "Bekmurodov", "Nurmatov", "Hakimov", "Sobirov", "Ochilov",
    ],
  },
  Jordan: {
    weight: 2,
    first: [
      "Yazan", "Mahmoud", "Anas", "Ehsan", "Musa", "Bahaa", "Nizar", "Odai",
      "Hamza", "Feras", "Saeed", "Ahmad", "Tareq", "Laith", "Zaid", "Amer",
      "Sami", "Khalil", "Rami", "Bilal", "Mutaz", "Ismail", "Karam", "Ayman",
    ],
    last: [
      "Alrawabdeh", "Almardi", "Alsaify", "Alfaqeeh", "Haddad", "Zreiqat", "Khattab", "Obeidat",
      "Shalabi", "Masalha", "Qatanani", "Tarawneh", "Sharaiha", "Hattab", "Barghouti", "Salameh",
      "Ghanem", "Nsour", "Rifai", "Dabbas", "Zawahreh", "Mansour", "Adwan", "Btoush",
    ],
  },
  Thailand: {
    weight: 2,
    first: [
      "Somchai", "Anuwat", "Pornthep", "Wichai", "Kittipong", "Nattawut", "Peerapat", "Worachit",
      "Jakkaphan", "Chaowat", "Thanawat", "Sarawut", "Nopporn", "Pichai", "Weerapong", "Krit",
      "Surachai", "Panupong", "Thanakrit", "Watcharin", "Sittichai", "Narong", "Prasert", "Chalermchai",
    ],
    last: [
      "Sangkaew", "Chaiyaphum", "Boonmathan", "Wongchai", "Srisuk", "Phromphao", "Kaewkla", "Thongchai",
      "Ratchanon", "Suksawat", "Prathum", "Charoensuk", "Meesap", "Ngamsom", "Panyapha", "Rungrueang",
      "Sitthichok", "Chindawong", "Bunlue", "Kanchana", "Somboon", "Wattana", "Yaemyuean", "Pholsawat",
    ],
  },
  Vietnam: {
    weight: 2,
    first: [
      "Quang", "Cong", "Duy", "Tien", "Hoang", "Minh", "Tuan", "Van",
      "Thanh", "Hung", "Trong", "Duc", "Anh", "Bao", "Khanh", "Nam",
      "Phuc", "Long", "Kien", "Truong", "Dat", "Hieu", "Vinh", "Son",
    ],
    last: [
      "Nguyen", "Tran", "Le", "Pham", "Hoang", "Phan", "Vu", "Dang",
      "Bui", "Do", "Ho", "Ngo", "Duong", "Ly", "Dinh", "Truong",
      "Cao", "Mai", "Ta", "Trinh", "Luong", "Doan", "Quach", "Chu",
    ],
  },
  Indonesia: {
    weight: 2,
    first: [
      "Bagus", "Rizky", "Andik", "Yanto", "Bambang", "Irfan", "Dedi", "Rachmat",
      "Ilham", "Dimas", "Kadek", "Wahyu", "Gian", "Yakob", "Ricky", "Agung",
      "Budi", "Hendra", "Joko", "Rudi", "Slamet", "Teguh", "Wawan", "Yudi",
    ],
    last: [
      "Setiawan", "Wibowo", "Kurniawan", "Nugroho", "Santoso", "Hidayat", "Saputra", "Prasetyo",
      "Wijaya", "Susanto", "Utomo", "Hartono", "Firmansyah", "Ramadhan", "Maulana", "Permana",
      "Anggara", "Sihombing", "Simanjuntak", "Purnama", "Aditya", "Gunawan", "Harahap", "Sinaga",
    ],
  },
  Malaysia: {
    weight: 2,
    first: [
      "Syafiq", "Faisal", "Aidil", "Hafiz", "Azam", "Nazmi", "Farid", "Shahrul",
      "Amri", "Khairul", "Rizal", "Adam", "Harith", "Zafuan", "Nasir", "Akhyar",
      "Danial", "Haziq", "Izzat", "Luqman", "Naim", "Redzuan", "Shukri", "Zulhilmi",
    ],
    last: [
      "Rasid", "Ahmad", "Halim", "Ismail", "Yusof", "Rahman", "Hashim", "Aziz",
      "Salleh", "Osman", "Jantan", "Nasir", "Mokhtar", "Ramli", "Zainal", "Kadir",
      "Mansor", "Sulaiman", "Idris", "Bakar", "Talib", "Wahab", "Zulkifli", "Latif",
    ],
  },
  Hungary: {
    weight: 2,
    first: [
      "Bence", "Adam", "Daniel", "Roland", "Zsolt", "Attila", "Gergo", "Balazs",
      "Marton", "Norbert", "Peter", "Laszlo", "Tamas", "Istvan", "Krisztian", "Andras",
      "Gabor", "Mate", "Levente", "Csaba", "Zoltan", "Akos", "Botond", "Kristof",
    ],
    last: [
      "Nagy", "Kovacs", "Toth", "Szabo", "Horvath", "Varga", "Kiss", "Molnar",
      "Nemeth", "Farkas", "Balogh", "Papp", "Takacs", "Juhasz", "Lakatos", "Meszaros",
      "Olah", "Simon", "Racz", "Fekete", "Torok", "Gulyas", "Fabian", "Veres",
    ],
  },
  Bulgaria: {
    weight: 2,
    first: [
      "Georgi", "Ivan", "Dimitar", "Nikola", "Petar", "Stefan", "Todor", "Martin",
      "Kiril", "Aleksandar", "Vasil", "Boris", "Emil", "Radoslav", "Plamen", "Krasimir",
      "Yordan", "Zdravko", "Lyubomir", "Simeon", "Valeri", "Rumen", "Milen", "Ognyan",
    ],
    last: [
      "Ivanov", "Petrov", "Dimitrov", "Georgiev", "Nikolov", "Todorov", "Stoyanov", "Angelov",
      "Iliev", "Kolev", "Marinov", "Vasilev", "Popov", "Hristov", "Atanasov", "Borisov",
      "Yanev", "Zlatev", "Delchev", "Kirilov", "Manolov", "Rusev", "Tsvetkov", "Slavov",
    ],
  },
  Russia: {
    weight: 2,
    first: [
      "Aleksandr", "Dmitri", "Sergei", "Andrei", "Ivan", "Maksim", "Nikolai", "Roman",
      "Artem", "Denis", "Kirill", "Egor", "Vladimir", "Pavel", "Anton", "Yuri",
      "Mikhail", "Aleksei", "Ilya", "Danila", "Gleb", "Timur", "Fedor", "Vadim",
    ],
    last: [
      "Ivanov", "Smirnov", "Kuznetsov", "Popov", "Sokolov", "Lebedev", "Kozlov", "Novikov",
      "Morozov", "Petrov", "Volkov", "Solovyov", "Vasilyev", "Zaytsev", "Pavlov", "Semenov",
      "Golubev", "Vinogradov", "Bogdanov", "Vorobyov", "Fedorov", "Mikhailov", "Belyaev", "Tarasov",
    ],
  },
  Georgia: {
    weight: 2,
    first: [
      "Giorgi", "Levan", "Nika", "Irakli", "Zurab", "Davit", "Otar", "Guram",
      "Vakhtang", "Saba", "Luka", "Beka", "Tornike", "Aleksandre", "Shota", "Merab",
      "Lasha", "Gela", "Temur", "Ilia", "Zaza", "Rati", "Nodar", "Sandro",
    ],
    last: [
      "Beridze", "Lomidze", "Gogia", "Chkheidze", "Maisuradze", "Tsiklauri", "Kapanadze", "Javakhishvili",
      "Mikeladze", "Nozadze", "Gelashvili", "Kobakhidze", "Tabatadze", "Baramidze", "Dzneladze", "Kharaishvili",
      "Papava", "Sturua", "Tsereteli", "Gurgenidze", "Kutateladze", "Chikovani", "Meladze", "Tsulaia",
    ],
  },
  "North Macedonia": {
    weight: 2,
    first: [
      "Goran", "Stefan", "Aleksandar", "Darko", "Ilija", "Bojan", "Nikola", "Marjan",
      "Vlatko", "Filip", "Kire", "Dejan", "Zoran", "Mite", "Trajko", "Blagoja",
      "Ognen", "Risto", "Slave", "Vanco", "Igor", "Petar", "Mario", "Boban",
    ],
    last: [
      "Stojanovski", "Ristovski", "Trajkovski", "Nikolovski", "Petrovski", "Georgievski", "Dimitrievski", "Angelovski",
      "Ivanovski", "Mitrevski", "Jovanovski", "Velkovski", "Spasovski", "Todorovski", "Kostovski", "Bogdanovski",
      "Naumovski", "Zdravkovski", "Manevski", "Cvetkovski", "Lazarevski", "Simonovski", "Panev", "Gjorgjev",
    ],
  },
  Montenegro: {
    weight: 2,
    first: [
      "Stefan", "Marko", "Nikola", "Milos", "Vladimir", "Luka", "Filip", "Aleksandar",
      "Dejan", "Igor", "Bojan", "Danilo", "Petar", "Risto", "Zarko", "Vukan",
      "Balsa", "Nemanja", "Andrija", "Milan", "Uros", "Savo", "Drasko", "Mirko",
    ],
    last: [
      "Vukcevic", "Jovanovic", "Popovic", "Radovic", "Perovic", "Boskovic", "Djukic", "Scepanovic",
      "Vujosevic", "Kaludjerovic", "Lekic", "Ivanovic", "Nikolic", "Milic", "Backovic", "Raicevic",
      "Djurovic", "Tomasevic", "Knezevic", "Bulatovic", "Markovic", "Adzic", "Kalezic", "Zecevic",
    ],
  },
  "Northern Ireland": {
    weight: 2,
    first: [
      "Steven", "Jonny", "Craig", "Niall", "Conor", "Paddy", "Shane", "Gareth",
      "Stuart", "Ciaron", "Daniel", "Ryan", "Michael", "Liam", "Trai", "Bailey",
      "Isaac", "Jordan", "Aaron", "Kyle", "Ross", "Dale", "Rory", "Barry",
    ],
    last: [
      "Ferguson", "Hughes", "Bradley", "Donnelly", "McCann", "Reilly", "Devine", "Kearns",
      "Charles", "Toal", "Peacock", "Hume", "Brown", "McKenna", "Doherty", "Campbell",
      "Gallagher", "Hamilton", "Kennedy", "Maguire", "Nolan", "Quinn", "Sloan", "Thompson",
    ],
  },
  Belarus: {
    weight: 2,
    first: [
      "Maksim", "Ihar", "Siarhei", "Dzmitry", "Yauheni", "Aliaksandr", "Vitaly", "Anton",
      "Pavel", "Uladzimir", "Mikita", "Kiryl", "Raman", "Artsiom", "Yury", "Andrei",
      "Stanislau", "Valery", "Denis", "Ivan", "Hleb", "Nikolai", "Ruslan", "Vadzim",
    ],
    last: [
      "Ivanou", "Kavalenka", "Novik", "Sauchanka", "Yarmolenka", "Bandarenka", "Karpovich", "Shestakou",
      "Zhuk", "Kazlou", "Marozau", "Dubrouka", "Hancharou", "Sidarenka", "Vasilieu", "Klimovich",
      "Rybak", "Astapenka", "Miatliuk", "Pashkevich", "Sakalou", "Zaitsau", "Belski", "Hrytsuk",
    ],
  },
  Ethiopia: {
    weight: 2,
    first: [
      "Abebe", "Tesfaye", "Getachew", "Bekele", "Dawit", "Yohannes", "Solomon", "Mulugeta",
      "Girma", "Alemayehu", "Fikru", "Henok", "Samson", "Biruk", "Tewodros", "Kalab",
      "Addis", "Berhanu", "Eyasu", "Nahom", "Robel", "Sisay", "Yared", "Zewdu",
    ],
    last: [
      "Tadesse", "Haile", "Kebede", "Assefa", "Wolde", "Mekonnen", "Desta", "Gebre",
      "Tekle", "Alemu", "Belay", "Negash", "Abera", "Demissie", "Gizaw", "Lemma",
      "Mengistu", "Shiferaw", "Teshome", "Worku", "Yimer", "Zerihun", "Habte", "Ayele",
    ],
  },
  Uganda: {
    weight: 2,
    first: [
      "Emmanuel", "Farouk", "Allan", "Khalid", "Milton", "Ibrahim", "Moses", "Joseph",
      "Ronald", "Isaac", "Tadeo", "Halid", "Steven", "Fahad", "Patrick", "Derrick",
      "Timothy", "Kenneth", "Aziz", "Yunus", "Gavin", "Simon", "Robert", "Julius",
    ],
    last: [
      "Ssekiganda", "Lwanga", "Kaddu", "Mutyaba", "Nsibambi", "Walusimbi", "Ssenkumba", "Katongole",
      "Mugume", "Sserunkuma", "Wasswa", "Tumusiime", "Okello", "Kagimu", "Lubega", "Mukasa",
      "Nabende", "Ochieng", "Opio", "Ssembatya", "Tugume", "Wanyama", "Kizza", "Namara",
    ],
  },
  Zimbabwe: {
    weight: 2,
    first: [
      "Knowledge", "Marvelous", "Tendai", "Marshall", "Talent", "Tinotenda", "Blessing", "Terrence",
      "Divine", "Prince", "Kudakwashe", "Munashe", "Farai", "Tafadzwa", "Simba", "Panashe",
      "Brighton", "Takudzwa", "Never", "Wellington", "Admiral", "Costa", "Tapiwa", "Nyasha",
    ],
    last: [
      "Moyo", "Ndlovu", "Sibanda", "Dube", "Mpofu", "Chirwa", "Mavhunga", "Mudimu",
      "Marufu", "Gwekwerere", "Rusike", "Mangwiro", "Chikwature", "Gumbo", "Madzivanyika", "Nyoni",
      "Shumba", "Tsvangirai", "Zhou", "Mutasa", "Chigumba", "Makoni", "Nhema", "Zvobgo",
    ],
  },
  Sudan: {
    weight: 2,
    first: [
      "Mohamed", "Ahmed", "Abdelrahman", "Musab", "Salah", "Waleed", "Bakri", "Yasir",
      "Tayseer", "Sharaf", "Mustafa", "Osman", "Hisham", "Kamal", "Idris", "Ammar",
      "Mazin", "Rayan", "Sabir", "Hatim", "Omar", "Zuhair", "Nasr", "Tarig",
    ],
    last: [
      "Abdalla", "Elsheikh", "Hassan", "Ibrahim", "Osman", "Ahmed", "Mahmoud", "Bakhit",
      "Hamid", "Yousif", "Suleiman", "Adam", "Elamin", "Gasim", "Nour", "Tia",
      "Karrar", "Fadl", "Mukhtar", "Rahma", "Salih", "Tambal", "Wadi", "Zakaria",
    ],
  },
  Libya: {
    weight: 2,
    first: [
      "Muaid", "Ahmed", "Sand", "Mohamed", "Faisal", "Anis", "Ali", "Omar",
      "Salem", "Tareq", "Motasem", "Abdullah", "Sofiane", "Nader", "Rabie", "Marwan",
      "Ayoub", "Khaled", "Bilal", "Mansour", "Younes", "Hussein", "Adel", "Fathi",
    ],
    last: [
      "Alsaghir", "Bengargeb", "Zubya", "Alfitouri", "Almeriami", "Elshaykhi", "Abdelrahman", "Alghazal",
      "Elmabrouk", "Ashour", "Krewi", "Almuntasir", "Bendarwish", "Elhadi", "Ferjani", "Gwaider",
      "Hamad", "Kadiki", "Nashnoush", "Salem", "Tarhouni", "Zubi", "Misrati", "Werfalli",
    ],
  },
  Togo: {
    weight: 2,
    first: [
      "Kodjo", "Kossi", "Yao", "Komlan", "Serge", "Mathieu", "Floyd", "Peniel",
      "Roger", "Kevin", "Sadat", "Thibault", "Samuel", "Fo", "Gnama", "Dove",
      "Atakora", "Bassah", "Kwame", "Etse", "Afi", "Elom", "Mawuli", "Sena",
    ],
    last: [
      "Akakpo", "Amewou", "Segbefia", "Tchakei", "Lawson", "Aholou", "Bessan", "Djiwa",
      "Fambo", "Kossi", "Mensah", "Nyavor", "Ouro", "Tchagnirou", "Adjei", "Akoto",
      "Attiogbe", "Bawa", "Djato", "Folly", "Gnandi", "Kponton", "Sowu", "Tetteh",
    ],
  },
  Benin: {
    weight: 2,
    first: [
      "Steve", "Jodel", "Cebio", "Olivier", "Mickael", "Jordan", "David", "Marcellin",
      "Rodrigue", "Yohan", "Desire", "Khaled", "Junior", "Tidjani", "Seibou", "Imourane",
      "Moise", "Cedric", "Farid", "Andreas", "Emmanuel", "Rachad", "Bruno", "Landry",
    ],
    last: [
      "Dossou", "Kiki", "Ahouanou", "Assogba", "Hountondji", "Agbegniadan", "Bokpe", "Djidonou",
      "Gbaguidi", "Hodonou", "Koukpo", "Lokonon", "Migan", "Nouwatin", "Olou", "Sagbo",
      "Tchomogo", "Zohoun", "Adjovi", "Dakpogan", "Houngbedji", "Kponou", "Sohou", "Zinsou",
    ],
  },
  Guatemala: {
    weight: 2,
    first: [
      "Carlos", "Jose", "Luis", "Rodrigo", "Marco", "Nicolas", "Oscar", "Jorge",
      "Antonio", "Rafael", "Jesus", "Fredy", "Kevin", "Alejandro", "Elias", "Gerardo",
      "Juan", "Pedro", "Erick", "Manuel", "Diego", "Cristian", "Aaron", "Byron",
    ],
    last: [
      "Morales", "Lopez", "Ruiz", "Hernandez", "Perez", "Garcia", "Rodriguez", "Castillo",
      "Mendez", "Ramirez", "Santis", "Estrada", "Contreras", "Oliva", "Marroquin", "Cardona",
      "Alvarez", "Palencia", "Cabrera", "Barrios", "Chinchilla", "Figueroa", "Monterroso", "Quinonez",
    ],
  },
  "El Salvador": {
    weight: 2,
    first: [
      "Nelson", "Darwin", "Jairo", "Marvin", "Enrico", "Kevin", "Christian", "Ronald",
      "Bryan", "Mario", "Herbert", "Gerson", "Narciso", "Amando", "Denis", "Roberto",
      "Diego", "Ivan", "Joaquin", "Rodolfo", "Walter", "Oscar", "Salvador", "Nahun",
    ],
    last: [
      "Cerritos", "Henriquez", "Ceren", "Zelaya", "Bonilla", "Portillo", "Menjivar", "Escobar",
      "Alas", "Rugamas", "Turcios", "Cruz", "Landaverde", "Sanchez", "Melgar", "Quintanilla",
      "Aguilar", "Chavez", "Duran", "Guevara", "Mejia", "Rivas", "Interiano", "Ventura",
    ],
  },
  "Trinidad and Tobago": {
    weight: 2,
    first: [
      "Kevin", "Levi", "Alvin", "Khaleem", "Joevin", "Sheldon", "Aubrey", "Nathan",
      "Reon", "Daniel", "Marvin", "Neveal", "Justin", "Ryan", "Andre", "Trevin",
      "Duane", "Curtis", "Jesse", "Malcolm", "Shannon", "Tyrone", "Willis", "Kern",
    ],
    last: [
      "Garcia", "Jones", "Hyland", "Bateau", "Phillip", "Fenlon", "Hackshaw", "Toussaint",
      "Gonzales", "Charles", "Lewis", "Andrews", "Baptiste", "Boucaud", "Chase", "Dyer",
      "Edwards", "Guerra", "John", "Marcelle", "Peltier", "Williams", "Alexander", "Superville",
    ],
  },
  Fiji: {
    weight: 2,
    first: [
      "Setareki", "Iosefo", "Napolioni", "Sairusi", "Antonio", "Scott", "Praneel", "Ratu",
      "Meli", "Kolinio", "Epeli", "Waisake", "Simione", "Jale", "Tevita", "Alvin",
      "Beniamino", "Christopher", "Dave", "Filipe", "Josaia", "Manasa", "Peni", "Semi",
    ],
    last: [
      "Verma", "Naidu", "Baleinamau", "Tuivuna", "Tuisawau", "Rasova", "Dunadamu", "Ravonokula",
      "Waqanidrola", "Nawatu", "Ratudradra", "Bolatagane", "Cavubati", "Delana", "Koroi", "Lomani",
      "Matai", "Naicker", "Prasad", "Rokovada", "Singh", "Vosarogo", "Naiqama", "Tabua",
    ],
  },
  "Papua New Guinea": {
    weight: 2,
    first: [
      "Raymond", "Tommy", "Nigel", "David", "Michael", "Alwin", "Emmanuel", "Ronald",
      "Kolu", "Yagi", "Gimo", "Nicholas", "Felix", "Jacob", "Koriak", "Daniel",
      "Obert", "Philip", "Samuel", "Timothy", "Valentine", "Wesley", "Andrew", "Bill",
    ],
    last: [
      "Semmy", "Dabinyaba", "Muta", "Foster", "Simon", "Warup", "Kaipu", "Aisa",
      "Bakani", "Daera", "Gerard", "Hebou", "Joseph", "Kepo", "Lepani", "Molean",
      "Nawi", "Pagan", "Reu", "Tovi", "Waine", "Yakasa", "Kimai", "Talusa",
    ],
  },
};

// "Other Nations (combined)" bucket — a country is picked uniformly among
// these when the weighted roll lands in that combined slot.
export const OTHER_NATIONS: Record<string, { first: string[]; last: string[] }> = {
  Egypt: {
    first: [
      "Ahmed", "Mohamed", "Mahmoud", "Mostafa", "Omar", "Youssef", "Khaled", "Tarek",
      "Abdallah", "Amr", "Ayman", "Ehab", "Hany", "Hossam", "Islam", "Karim",
      "Marwan", "Nader", "Ramy", "Sherif", "Wael", "Yasser", "Ziad", "Fady",
    ],
    last: [
      "Hassan", "Ibrahim", "Mahmoud", "Abdelrahman", "Fathy", "Ramadan", "Shawky", "Kamal",
      "Abdelaziz", "Adel", "Ashour", "Badr", "Ezzat", "Farouk", "Fawzy", "Gaber",
      "Halim", "Mansour", "Nasser", "Rashad", "Sabry", "Samir", "Tawfik", "Zaki",
    ],
  },
  Tunisia: {
    first: [
      "Mohamed", "Ahmed", "Youssef", "Anis", "Bilel", "Hamza", "Seifeddine", "Oussama",
      "Aymen", "Bassem", "Chaker", "Firas", "Ghaith", "Hedi", "Iheb", "Khalil",
      "Marwen", "Mehdi", "Nassim", "Rami", "Skander", "Taha", "Wajdi", "Zied",
    ],
    last: [
      "Trabelsi", "Jebali", "Gharbi", "Mansouri", "Hammami", "Chebbi", "Dridi", "Ayari",
      "Abidi", "Baccouche", "Belhadj", "Ben Salah", "Bouazizi", "Chouchane", "Hamdi", "Jaziri",
      "Karoui", "Laabidi", "Mejri", "Nasri", "Ouertani", "Rekik", "Sassi", "Zouari",
    ],
  },
  Chile: {
    first: [
      "Matias", "Benjamin", "Vicente", "Joaquin", "Cristobal", "Diego", "Felipe", "Ignacio",
      "Alonso", "Bastian", "Bruno", "Cristian", "Esteban", "Franco", "Gabriel", "Gonzalo",
      "Javier", "Lucas", "Martin", "Nicolas", "Pablo", "Rodrigo", "Sebastian", "Tomas",
    ],
    last: [
      "Munoz", "Rojas", "Soto", "Contreras", "Silva", "Fuentes", "Espinoza", "Araya",
      "Aravena", "Bravo", "Carrasco", "Cortes", "Diaz", "Fuenzalida", "Gutierrez", "Herrera",
      "Lagos", "Morales", "Nunez", "Orellana", "Pizarro", "Reyes", "Tapia", "Valenzuela",
    ],
  },
  Peru: {
    first: [
      "Luis", "Jose", "Carlos", "Jorge", "Miguel", "Renzo", "Alonso", "Piero",
      "Andre", "Christian", "Diego", "Edison", "Fabio", "Gianluca", "Hernan", "Jean",
      "Joel", "Juan", "Manuel", "Marcos", "Paolo", "Sergio", "Wilder", "Rodrigo",
    ],
    last: [
      "Quispe", "Flores", "Huaman", "Chavez", "Rojas", "Torres", "Castillo", "Salazar",
      "Aguirre", "Alvarado", "Cabrera", "Cardenas", "Espinoza", "Gomez", "Guerrero", "Mamani",
      "Mendoza", "Palacios", "Ramos", "Reyna", "Sanchez", "Vasquez", "Vilca", "Zegarra",
    ],
  },
  Bolivia: {
    first: [
      "Juan", "Carlos", "Luis", "Marco", "Ronald", "Diego", "Jhasmani", "Rodrigo",
      "Alejandro", "Alvaro", "Bruno", "Danny", "Edwin", "Erwin", "Fernando", "Gabriel",
      "Gustavo", "Henry", "Jorge", "Leonel", "Marcelo", "Moises", "Nelson", "Ramiro",
    ],
    last: [
      "Mamani", "Quispe", "Flores", "Condori", "Choque", "Vargas", "Rojas", "Gutierrez",
      "Aguilar", "Apaza", "Arce", "Cespedes", "Colque", "Fernandez", "Justiniano", "Limachi",
      "Mendez", "Morales", "Poma", "Sanchez", "Ticona", "Villarroel", "Zurita", "Calderon",
    ],
  },
  Iran: {
    first: [
      "Ali", "Reza", "Amir", "Hossein", "Mehdi", "Saeid", "Arman", "Pouya",
      "Abbas", "Ahmad", "Behnam", "Danial", "Ehsan", "Farhad", "Hamid", "Iman",
      "Kaveh", "Majid", "Milad", "Mohsen", "Navid", "Omid", "Peyman", "Vahid",
    ],
    last: [
      "Hosseini", "Ahmadi", "Rezaei", "Moradi", "Jafari", "Kazemi", "Sadeghi", "Ebrahimi",
      "Abbasi", "Akbari", "Alavi", "Bagheri", "Fazli", "Ghasemi", "Hashemi", "Karimi",
      "Mohammadi", "Mousavi", "Naderi", "Rahimi", "Salehi", "Shirazi", "Tabatabaei", "Yousefi",
    ],
  },
  China: {
    first: [
      "Wei", "Jun", "Hao", "Lei", "Ming", "Bo", "Tao", "Bin",
      "Cheng", "Gang", "Guang", "Hui", "Jian", "Kai", "Long", "Peng",
      "Qiang", "Sheng", "Wen", "Xiang", "Yong", "Zhi", "Jie", "Yu",
    ],
    last: [
      "Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Huang", "Zhao",
      "Cao", "Deng", "Feng", "Guo", "Han", "He", "Hu", "Lin",
      "Luo", "Ma", "Song", "Sun", "Tang", "Wu", "Xu", "Zhou",
    ],
  },
  India: {
    first: [
      "Arjun", "Rohan", "Rahul", "Vikram", "Aditya", "Karan", "Nikhil", "Sanjay",
      "Amit", "Ankit", "Deepak", "Gaurav", "Harish", "Kunal", "Manish", "Pranav",
      "Rajesh", "Ravi", "Rohit", "Sachin", "Siddharth", "Suresh", "Varun", "Vivek",
    ],
    last: [
      "Sharma", "Singh", "Kumar", "Patel", "Nair", "Das", "Reddy", "Verma",
      "Bhatt", "Chauhan", "Desai", "Gupta", "Iyer", "Jain", "Joshi", "Kapoor",
      "Malhotra", "Menon", "Mishra", "Pillai", "Rao", "Saxena", "Shetty", "Yadav",
    ],
  },
  Israel: {
    first: [
      "Noam", "Itai", "Yonatan", "Amit", "Omer", "Daniel", "Gal", "Idan",
      "Ariel", "Aviv", "Dor", "Eitan", "Eyal", "Guy", "Lior", "Maor",
      "Nadav", "Nir", "Ofir", "Oren", "Roi", "Shai", "Tomer", "Yuval",
    ],
    last: [
      "Cohen", "Levi", "Mizrahi", "Peretz", "Biton", "Avraham", "Dahan", "Azoulay",
      "Amar", "Barak", "Ben David", "Elbaz", "Gabay", "Hadad", "Katz", "Malka",
      "Nissim", "Ohana", "Regev", "Sasson", "Shalom", "Tal", "Yosef", "Zohar",
    ],
  },
  "New Zealand": {
    first: [
      "Liam", "Jack", "Oliver", "Hunter", "Mason", "Blake", "Finn", "Toby",
      "Archie", "Ben", "Callum", "Cameron", "Cody", "Ethan", "Harry", "Jayden",
      "Josh", "Kane", "Luke", "Nathan", "Reece", "Ryan", "Tama", "Zane",
    ],
    last: [
      "Wilson", "Thompson", "Anderson", "Walker", "Harris", "Ngata", "Parata", "Clarke",
      "Baker", "Bennett", "Carter", "Cooper", "Edwards", "Hall", "Kingi", "Mitchell",
      "Murray", "Rangi", "Reid", "Robinson", "Taylor", "Turner", "Whittaker", "Wiremu",
    ],
  },
  Jamaica: {
    first: [
      "Andre", "Damion", "Shane", "Ricardo", "Omar", "Devon", "Kemar", "Jerome",
      "Anthony", "Dwayne", "Javon", "Kadeem", "Marlon", "Nicholas", "Odane", "Oshane",
      "Rohan", "Shamar", "Tyrese", "Kimani", "Deshawn", "Rushane", "Alwyn", "Damar",
    ],
    last: [
      "Brown", "Williams", "Campbell", "Grant", "Reid", "Thompson", "Blake", "Morrison",
      "Anderson", "Bailey", "Barrett", "Clarke", "Dixon", "Ellis", "Francis", "Gordon",
      "Henry", "Johnson", "Lawrence", "McKenzie", "Palmer", "Powell", "Robinson", "Wright",
    ],
  },
  "Costa Rica": {
    first: [
      "Jose", "Carlos", "Luis", "Andres", "Esteban", "Randall", "Marco", "Kenneth",
      "Alonso", "Bryan", "Christian", "Daniel", "David", "Diego", "Elias", "Fernando",
      "Gerson", "Jonathan", "Juan", "Manuel", "Mauricio", "Ronald", "Sergio", "Joel",
    ],
    last: [
      "Vargas", "Rodriguez", "Jimenez", "Mora", "Solano", "Chaves", "Rojas", "Salas",
      "Aguilar", "Alvarado", "Araya", "Brenes", "Calvo", "Campos", "Castro", "Cordero",
      "Gamboa", "Hernandez", "Madrigal", "Montero", "Quesada", "Ramirez", "Segura", "Zamora",
    ],
  },
  Honduras: {
    first: [
      "Carlos", "Jorge", "Marvin", "Wilmer", "Selvin", "Edwin", "Jerry", "Oscar",
      "Alexander", "Bryan", "Douglas", "Elmer", "Erick", "Franklin", "Jonathan", "Kevin",
      "Luis", "Mario", "Michael", "Rigoberto", "Roger", "Walter", "Deybi", "Yustin",
    ],
    last: [
      "Martinez", "Lopez", "Flores", "Mejia", "Castro", "Zelaya", "Padilla", "Espinal",
      "Amaya", "Bonilla", "Cruz", "Elvir", "Garcia", "Hernandez", "Izaguirre", "Lozano",
      "Maradiaga", "Murillo", "Palacios", "Pineda", "Rivera", "Sandoval", "Velasquez", "Discua",
    ],
  },
  Panama: {
    first: [
      "Jose", "Luis", "Alberto", "Ricardo", "Armando", "Rolando", "Ismael", "Gabriel",
      "Abdiel", "Adalberto", "Alfredo", "Anibal", "Cristian", "Edgar", "Eric", "Fidel",
      "Harold", "Jorge", "Juan", "Marcos", "Michael", "Omar", "Rodrigo", "Ivan",
    ],
    last: [
      "Gonzalez", "Rodriguez", "Perez", "Castillo", "Sanchez", "Aguilar", "Beitia", "Camargo",
      "Arauz", "Barria", "Carrasquilla", "Cedeno", "Cordoba", "Escobar", "Fajardo", "Guerra",
      "Machado", "Miranda", "Murillo", "Ortega", "Quintero", "Renteria", "Samaniego", "Tejada",
    ],
  },
  Zambia: {
    first: [
      "Emmanuel", "Chanda", "Mwape", "Kelvin", "Lubinda", "Gift", "Brian", "Moses",
      "Aaron", "Andrew", "Charles", "Dennis", "Enock", "Isaac", "Jacob", "Kabaso",
      "Kennedy", "Lameck", "Peter", "Rodgers", "Simon", "Mubita", "Chola", "Musonda",
    ],
    last: [
      "Banda", "Phiri", "Mwansa", "Tembo", "Zulu", "Mulenga", "Chirwa", "Musonda",
      "Bwalya", "Chanda", "Chileshe", "Kangwa", "Katongo", "Lungu", "Mumba", "Mwanza",
      "Sakala", "Sichone", "Simfukwe", "Zimba", "Kalunga", "Mwila", "Nkonde", "Siame",
    ],
  },
  Kenya: {
    first: [
      "Brian", "Kevin", "Dennis", "Collins", "Victor", "Eric", "Samuel", "Joseph",
      "Anthony", "Bernard", "Charles", "David", "Duncan", "Elijah", "Francis", "George",
      "James", "John", "Kelvin", "Michael", "Patrick", "Paul", "Peter", "Stephen",
    ],
    last: [
      "Otieno", "Mwangi", "Kamau", "Ochieng", "Njoroge", "Kiprop", "Wafula", "Mutua",
      "Barasa", "Cheruiyot", "Gitau", "Kariuki", "Kimani", "Kiplagat", "Maina", "Muturi",
      "Ndungu", "Nyaga", "Odhiambo", "Omondi", "Onyango", "Ouma", "Wanjala", "Waweru",
    ],
  },
  Gabon: {
    first: [
      "Denis", "Bruno", "Guy", "Serge", "Herve", "Franck", "Ulrich", "Yannis",
      "Alain", "Andre", "Cedric", "Christian", "Didier", "Fabrice", "Gaston", "Jean",
      "Johann", "Landry", "Lloyd", "Marcel", "Patrick", "Rodrigue", "Stephane", "Axel",
    ],
    last: [
      "Ondo", "Nzue", "Moussavou", "Obiang", "Mba", "Ekomy", "Ivanga", "Ndong",
      "Assele", "Bekale", "Essono", "Koumba", "Makaya", "Mengue", "Mihindou", "Nguema",
      "Obame", "Ovono", "Bouanga", "Ditsoga", "Mabika", "Ndoumbe", "Nzigou", "Poaty",
    ],
  },
  Angola: {
    first: [
      "Joao", "Pedro", "Manuel", "Antonio", "Domingos", "Helder", "Wilson", "Edmilson",
      "Alberto", "Carlos", "Eduardo", "Fernando", "Gelson", "Herculano", "Jorge", "Jose",
      "Mario", "Miguel", "Nelson", "Paulo", "Rui", "Zito", "Bruno", "Osvaldo",
    ],
    last: [
      "dos Santos", "Fernandes", "Cabral", "Sebastiao", "Neto", "Gomes", "Lourenco", "Panzo",
      "Andre", "Antunes", "Dala", "Dias", "Manuel", "Mbala", "Mendonca", "Paulo",
      "Santana", "Silva", "Tavares", "Zola", "Bastos", "Kiala", "Mateus", "Nascimento",
    ],
  },
  Tanzania: {
    first: [
      "Juma", "Hamisi", "Rashidi", "Selemani", "Abdallah", "Issa", "Hassan", "Baraka",
      "Ally", "Amani", "Bakari", "Emmanuel", "Erasto", "Farid", "Ibrahim", "John",
      "Mohamed", "Musa", "Peter", "Salum", "Shaaban", "Simon", "Yusuph", "Nassoro",
    ],
    last: [
      "Said", "Mushi", "Massawe", "Shayo", "Kimaro", "Swai", "Temba", "Lyimo",
      "Kessy", "Msuya", "Ngassa", "Nyoni", "Rashid", "Sanga", "Shabani", "Tesha",
      "Kimario", "Malongo", "Mbwana", "Mkwasa", "Mlay", "Mwakyembe", "Ndege", "Semwaiko",
    ],
  },
  "South Africa": {
    first: [
      "Sipho", "Thabo", "Bongani", "Themba", "Lucky", "Katlego", "Sibusiso", "Andile",
      "Ayanda", "Bandile", "Kabelo", "Kagiso", "Lebo", "Mandla", "Mpho", "Musa",
      "Nkosinathi", "Oupa", "Sandile", "Sifiso", "Siyabonga", "Thulani", "Tshepo", "Vusi",
    ],
    last: [
      "Dlamini", "Nkosi", "Khumalo", "Mokoena", "Ndlovu", "Mahlangu", "Sithole", "Mabaso",
      "Mabena", "Mahlambi", "Maluleke", "Masango", "Mbatha", "Mkhize", "Mnguni", "Molefe",
      "Motaung", "Mthembu", "Ngcobo", "Nhlapo", "Radebe", "Zwane", "Sibanda", "Tshabalala",
    ],
  },
  Kosovo: {
    first: [
      "Arber", "Besart", "Endrit", "Fisnik", "Granit", "Leart", "Valon", "Blerim",
      "Agon", "Albin", "Ardian", "Arian", "Arlind", "Artan", "Astrit", "Behar",
      "Bekim", "Besnik", "Burim", "Dardan", "Driton", "Egzon", "Ermal", "Fatmir",
      "Florent", "Gazmend", "Ilir", "Jeton", "Kushtrim", "Labinot", "Liridon", "Mergim",
      "Muhamet", "Rron", "Shpend", "Valmir",
    ],
    last: [
      "Krasniqi", "Berisha", "Gashi", "Hoxha", "Shala", "Kastrati", "Morina", "Rexhepi",
      "Ahmeti", "Aliu", "Avdiu", "Bajrami", "Bekaj", "Bytyqi", "Dervishi", "Elshani",
      "Fazliu", "Gjocaj", "Halimi", "Hasani", "Ibrahimi", "Jashari", "Kelmendi", "Limani",
      "Maloku", "Musliu", "Nika", "Osmani", "Qerimi", "Rama", "Sadiku", "Selimi",
      "Zeqiri", "Beqiri", "Haziri", "Statovci",
    ],
  },
  "Ivory Coast": {
    first: ["Serge", "Yaya", "Wilfried", "Franck", "Cheick", "Ibrahim", "Seydou", "Max"],
    last: ["Kouame", "Toure", "Kone", "Bamba", "Gadji", "Yao", "Coulibaly", "Zoro"],
  },
  Greece: {
    first: [
      "Giorgos", "Dimitris", "Kostas", "Nikos", "Vasilis", "Panagiotis", "Christos", "Stelios",
      "Alexandros", "Andreas", "Anestis", "Antonis", "Apostolos", "Charalampos", "Dionysis", "Evangelos",
      "Fotis", "Grigoris", "Ilias", "Ioannis", "Lefteris", "Manolis", "Michalis", "Nektarios",
      "Pavlos", "Petros", "Sotiris", "Spyros", "Stavros", "Thanasis", "Theodoros", "Yiannis",
    ],
    last: [
      "Papadopoulos", "Nikolaou", "Georgiou", "Vlachos", "Karatzas", "Samaras", "Antoniou", "Christodoulou",
      "Alexopoulos", "Anagnostou", "Apostolou", "Dimitriou", "Economou", "Ioannou", "Karagiannis", "Katsaros",
      "Konstantinidis", "Makris", "Michailidis", "Nikolaidis", "Panagiotou", "Papageorgiou", "Papanikolaou", "Pappas",
      "Petridis", "Sideris", "Spanos", "Stavrou", "Theodorou", "Triantafyllou", "Vasileiou", "Zafeiriou",
    ],
  },
  "Cape Verde": {
    first: [
      "Nuno", "Ricardo", "Jorge", "Garry", "Kenny", "Dylan", "Adilson", "Bruno",
      "Carlos", "Celso", "Edmilson", "Elvis", "Fabio", "Gilson", "Hernani", "Ivan",
      "Joao", "Julio", "Leandro", "Manuel", "Marco", "Mario", "Nelson", "Odair",
      "Paulo", "Rui", "Sandro", "Steven", "Vagner", "Wilson", "Zito", "Djair",
    ],
    last: [
      "Tavares", "Furtado", "Lopes", "Semedo", "Rodrigues", "Fernandes", "Andrade", "Varela",
      "Almeida", "Barbosa", "Brito", "Cabral", "Correia", "Costa", "Delgado", "Duarte",
      "Evora", "Gomes", "Lima", "Livramento", "Mendes", "Monteiro", "Moreira", "Neves",
      "Pereira", "Pina", "Ramos", "Rocha", "Santos", "Silva", "Veiga", "Borges",
    ],
  },
  "Guinea-Bissau": {
    first: [
      "Mama", "Frederic", "Carlos", "Mamadu", "Bura", "Sori", "Abel", "Alfa",
      "Braima", "Bubacar", "Domingos", "Ernesto", "Fode", "Jose", "Malam", "Marciano",
      "Mario", "Nelson", "Paulo", "Samba", "Seco", "Tomas", "Umaro", "Iaguba",
    ],
    last: [
      "Balde", "Mendy", "Embalo", "Cande", "Djalo", "Na Silva", "Indjai", "Camara",
      "Barbosa", "Biai", "Cassama", "Co", "Correia", "Dabo", "Danfa", "Gomes",
      "Injai", "Mane", "Nanque", "Nhaga", "Pereira", "Sanha", "Seidi", "Vaz",
    ],
  },
};

// Sentinel key inside a league weight table standing for the combined
// "Rest of the World" share — when the weighted roll lands here, a nation is
// drawn from that league's tail pool (every nation NOT named in the table),
// weighted by its baseline frequency (see restPoolFor).
const REST = "__REST__";

/**
 * Per-league (home-country) nationality distributions, as relative weights
 * calibrated from real top-flight squad breakdowns (CIES-style). Each named
 * nation's weight is its stated percentage × 10; the REST sentinel's weight
 * is the league's "Rest of the World (Combined)" percentage × 10. Because
 * the source percentages don't sum to exactly 100 (rounding), the realized
 * shares are these weights normalized to the table total — the *relative*
 * proportions are preserved exactly, which is what matters.
 *
 * A club generates and draws youth from its own country's table. The
 * no-homeCountry / unknown-country path (global free agency, and any caller
 * that doesn't know a club's country) falls back to England's table — the
 * same "England-flavored" default the flat pool always was, just recalibrated
 * to the real EPL breakdown.
 *
 * Every named nation here has a name pool in NATIONALITIES or OTHER_NATIONS.
 * Türkiye maps to the existing "Turkey" entry; Kosovo's pool lives in
 * OTHER_NATIONS.
 */
export const LEAGUE_NATIONALITY_WEIGHTS: Record<string, Record<string, number>> = {
  England: {
    England: 394, France: 63, Brazil: 63, Netherlands: 60, Spain: 35, Germany: 30,
    Portugal: 28, Argentina: 25, Belgium: 25, Wales: 23, Italy: 22, Denmark: 22, Scotland: 22,
    [REST]: 210,
  },
  Spain: {
    Spain: 618, Argentina: 39, France: 26, Morocco: 26, Uruguay: 24, Brazil: 21,
    Netherlands: 16, Portugal: 14, Senegal: 10, Cameroon: 10, Nigeria: 10, England: 10,
    Sweden: 8, Germany: 8, Italy: 8, Colombia: 6, Mexico: 6, Japan: 6, Croatia: 6,
    [REST]: 144,
  },
  Italy: {
    Italy: 387, France: 52, Spain: 44, Netherlands: 26, Argentina: 26, Brazil: 23,
    Poland: 22, Croatia: 20, Serbia: 20, Denmark: 19, Sweden: 19, Portugal: 18, Belgium: 18,
    England: 15, Morocco: 15, Germany: 15,
    [REST]: 240,
  },
  Germany: {
    Germany: 440, France: 59, Austria: 52, Denmark: 34, Switzerland: 29, Japan: 27,
    Belgium: 23, "United States": 23, Netherlands: 22, Portugal: 22, Croatia: 20, Brazil: 16,
    Norway: 14, Sweden: 14, Argentina: 13, Italy: 13, Turkey: 13, Nigeria: 13,
    "Czech Republic": 13, Kosovo: 11, England: 11, Algeria: 11, Serbia: 11,
    [REST]: 65,
  },
  // Ligue 1: strong French base, then a Francophone West/North African tail
  // (Senegal/Ivory Coast/Morocco/Mali/Algeria/Cameroon) unique to French
  // football, plus Belgium/Portugal as developmental neighbours.
  France: {
    France: 556, Senegal: 81, "Ivory Coast": 51, Morocco: 42, Belgium: 32, Mali: 32,
    Algeria: 32, Portugal: 32, England: 26, Cameroon: 26, Brazil: 24, Ghana: 24,
    Argentina: 18, Nigeria: 18, Denmark: 16, Switzerland: 16, Netherlands: 14,
    [REST]: 81,
  },
  // Primeira Liga: heavily international but overwhelmingly Brazilian, then
  // Spain and the PALOP (Portuguese-speaking African) nations Angola/Cape
  // Verde/Guinea-Bissau — the league's distinctive cultural pipelines.
  Portugal: {
    Portugal: 448, Brazil: 234, Spain: 99, France: 44, Uruguay: 24, Colombia: 20,
    Greece: 18, Netherlands: 18, Angola: 18, Argentina: 16, Nigeria: 16,
    "Ivory Coast": 16, "Cape Verde": 14, Sweden: 14, "Guinea-Bissau": 14,
    England: 14, Senegal: 14, Morocco: 12,
    [REST]: 72,
  },
  // Jupiler Pro League: over 61% foreign — Europe's most multi-channel trading
  // hub. A large French intake, then pipelines no other league here has: Japan
  // (the biggest Japanese contingent in Europe) and a broad West/North African
  // spread, plus DR Congo reflecting Belgium's own diaspora.
  Belgium: {
    Belgium: 383, France: 95, Japan: 52, Senegal: 47, Morocco: 41, Germany: 36,
    "Ivory Coast": 34, Netherlands: 28, England: 28, Nigeria: 24, Denmark: 24, "DR Congo": 21,
    Ghana: 16, Sweden: 16, Switzerland: 16, Portugal: 13, Ecuador: 13, Serbia: 10, Guinea: 10,
    Cameroon: 10, Spain: 10, Algeria: 10, Austria: 10,
    [REST]: 53,
  },
  // Super Lig: roughly an even domestic/foreign split, with the foreign half
  // blending Brazil, Francophone West Africa and a Balkan tail (Kosovo, Bosnia,
  // Albania, Romania, Croatia) that is the league's most distinctive feature.
  // Bosnia-Herzegovina, Gambia and Albania live in UNLISTED_NATIONALITIES.
  Turkey: {
    Turkey: 480, Brazil: 47, "Ivory Coast": 33, Senegal: 31, Nigeria: 26, France: 26,
    Portugal: 26, Germany: 26, Romania: 24, Mali: 24, Kosovo: 21, "Bosnia-Herzegovina": 16,
    Gambia: 14, Poland: 14, Croatia: 14, "Cape Verde": 12, Morocco: 12, "DR Congo": 12,
    Netherlands: 9, Albania: 9, Cameroon: 9, Scotland: 9, Denmark: 9, England: 9, Belgium: 9,
    Tunisia: 9,
    [REST]: 65,
  },
};

// Baseline frequency of every nation that has a name pool, used to weight a
// league's "Rest of the World" tail so it stays varied and realistic (a
// common football nation shows up in the tail more than an obscure one)
// rather than uniform. NATIONALITIES nations keep their listed weight;
// OTHER_NATIONS (name-pool-only) nations get a small flat weight.
const OTHER_TAIL_WEIGHT = 3;
const TAIL_BASE: Record<string, number> = (() => {
  const base: Record<string, number> = {};
  for (const [country, def] of Object.entries(NATIONALITIES)) base[country] = def.weight;
  for (const country of Object.keys(OTHER_NATIONS)) base[country] = (base[country] ?? 0) + OTHER_TAIL_WEIGHT;
  return base;
})();

/**
 * A nationality distribution as relative weights: nation name -> weight, plus
 * the optional REST_OF_WORLD sentinel for the combined "rest of the world"
 * share. Shipped leagues use the calibrated tables above; a league the player
 * adds can carry one it authored itself.
 */
export type NationalityWeights = Record<string, number>;

/**
 * The key standing for the combined "rest of the world" share in a weight
 * table. Exported so a hand-authored table (world editor, roster file) can name
 * the same bucket the shipped tables use, rather than inventing a second
 * spelling the draw wouldn't recognize.
 */
export const REST_OF_WORLD = REST;

interface DerivedTable {
  total: number;
  rest: { entries: [string, number][]; total: number };
}

/**
 * Per-table memoized derivations, so the thousands of draws a world generation
 * makes don't re-walk these every call.
 *
 * Keyed on the table OBJECT rather than the league name, because a league the
 * player added carries its own table and has no stable name to key on — the
 * country name is free text they can still be editing. Each shipped league's
 * table is likewise a distinct, stable object, so this covers both with one
 * cache and cannot collide.
 */
const derivedCache = new WeakMap<NationalityWeights, DerivedTable>();

function derivedFor(table: NationalityWeights): DerivedTable {
  const cached = derivedCache.get(table);
  if (cached) return cached;

  let total = 0;
  const named = new Set<string>();
  for (const [country, w] of Object.entries(table)) {
    total += w;
    if (country !== REST) named.add(country);
  }

  // The tail pool: every name-pool-bearing nation NOT already named in this
  // table, weighted by its TAIL_BASE frequency.
  const entries: [string, number][] = [];
  let restTotal = 0;
  for (const [country, w] of Object.entries(TAIL_BASE)) {
    if (named.has(country)) continue;
    entries.push([country, w]);
    restTotal += w;
  }

  // A hand-authored table can name every nation the game has and still carry a
  // rest-of-world row, leaving that row nothing to draw from. Its weight comes
  // back out of the total, so the roll simply never lands there and the named
  // nations normalize among themselves — which is what an empty "everyone else"
  // means. The shipped tables can't reach this (each names a dozen of 78), so
  // it only became possible once tables were player-authored.
  if (entries.length === 0) total -= table[REST] ?? 0;

  const built: DerivedTable = { total, rest: { entries, total: restTotal } };
  derivedCache.set(table, built);
  return built;
}

/**
 * The realized share of each nation in a table, as percentages summing to 100,
 * with the REST_OF_WORLD bucket left as its own entry.
 *
 * Exists for the world editor, and it is not cosmetic: a table's weights are
 * normalized to whatever they happen to total, so a breakdown copied from a
 * real source (which routinely over-sums — the published Belgian list came to
 * 116.5%, the Turkish to 130.7%) silently produces a *smaller* domestic share
 * than it states. Showing the realized share next to the typed number is what
 * makes that visible instead of a surprise 20 seasons later.
 */
export function nationalityShares(table: NationalityWeights): [string, number][] {
  const { total, rest } = derivedFor(table);
  if (total <= 0) return [];
  return Object.entries(table).map(([country, w]) => {
    // A rest-of-world row with nobody left in it draws nothing (see derivedFor),
    // so it reads 0 rather than a share it will never actually deliver.
    if (country === REST && rest.entries.length === 0) return [country, 0];
    return [country, (100 * w) / total];
  });
}

/**
 * What the REST_OF_WORLD bucket in a given table actually expands to, richest
 * first. The tail is weighted by TAIL_BASE, which is built from the shipped
 * NATIONALITIES weights — i.e. calibrated from the *Premier League's* foreign
 * makeup, not a neutral global prior — so it leans English (~40% of the bucket
 * when nothing is named). That is right for an English league's tail and
 * surprising anywhere else, which is why the editor shows it.
 */
export function restOfWorldPreview(table: NationalityWeights, limit = 6): [string, number][] {
  const { rest } = derivedFor(table);
  if (rest.total <= 0) return [];
  return rest.entries
    .map(([c, w]) => [c, (100 * w) / rest.total] as [string, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/**
 * Drop everything a hand-authored table can't express, so a bad table degrades
 * to a usable one rather than to gibberish players.
 *
 * A nation with no name pool is dropped outright: generateName falls back to
 * synthesized nonsense words for an unknown nationality, so keeping it would
 * fill a league with players called "Zek Vopar" and no flag. Non-finite and
 * non-positive weights go too (a zero-weight row is just an unnamed nation, and
 * a negative one would corrupt the roll). Returns null if nothing usable is
 * left, which callers read as "fall back to the shipped behaviour".
 */
export function sanitizeNationalityWeights(
  table: NationalityWeights | undefined,
): NationalityWeights | null {
  if (!table) return null;
  const out: NationalityWeights = {};
  let total = 0;
  for (const [country, weight] of Object.entries(table)) {
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) continue;
    if (country !== REST && !namePoolFor(country)) continue;
    out[country] = weight;
    total += weight;
  }
  return total > 0 ? out : null;
}

/**
 * Weighted-random nationality draw from a resolved weight table. When the roll
 * lands in the combined "Rest of the World" slot, a second weighted roll picks
 * from that table's tail of all other nations.
 */
function drawFrom(rng: () => number, table: NationalityWeights): string {
  const { total, rest } = derivedFor(table);

  let roll = rng() * total;
  for (const [country, w] of Object.entries(table)) {
    if (roll < w) {
      if (country !== REST) return country;
      // derivedFor removes an empty rest-of-world row's weight from the total,
      // so the roll can't land here with nothing to draw. Belt and braces
      // against a float edge, since the alternative is indexing entries[-1].
      if (rest.entries.length === 0) break;
      let restRoll = rng() * rest.total;
      for (const [tailCountry, tw] of rest.entries) {
        if (restRoll < tw) return tailCountry;
        restRoll -= tw;
      }
      return rest.entries[rest.entries.length - 1][0];
    }
    roll -= w;
  }
  // Roll should always be consumed above; fall back to the last named nation.
  const named = Object.keys(table).filter((c) => c !== REST);
  return named[named.length - 1] ?? "England";
}

/**
 * Weighted-random nationality draw for a league.
 *
 * `custom` is a league's own hand-authored table (a league the player added in
 * the world editor, or one a roster file declared) and wins outright when
 * present. Otherwise `homeCountry` selects that country's real-calibrated
 * distribution (see LEAGUE_NATIONALITY_WEIGHTS), and a missing or unrecognized
 * country falls back to England's table — the England-flavored default the
 * global free-agency / no-country pool has always used.
 *
 * Note the draw consumes ONE rng value, or TWO when it lands in the rest-of-
 * world bucket. That is unchanged by this parameter, and it is only ever called
 * on a player's own identity sub-stream (see generatePlayer), so which table a
 * league uses cannot shift the shared rng sequence for any other player.
 */
export function pickNationality(
  rng: () => number,
  homeCountry?: string,
  custom?: NationalityWeights | null,
): string {
  if (custom) return drawFrom(rng, custom);
  const key = homeCountry && LEAGUE_NATIONALITY_WEIGHTS[homeCountry] ? homeCountry : "England";
  return drawFrom(rng, LEAGUE_NATIONALITY_WEIGHTS[key]);
}

export function namePoolFor(nationality: string): { first: string[]; last: string[] } | undefined {
  return NATIONALITIES[nationality] ?? OTHER_NATIONS[nationality] ?? UNLISTED_NATIONALITIES[nationality];
}
