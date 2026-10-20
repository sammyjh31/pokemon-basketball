import { Dialog } from "./Dialog";
const POSITION_GUIDE = [
  [
    "PG · Lead creator",
    "Passing, ball handling and speed. A slow or insecure handler limits even a talented passer.",
  ],
  [
    "SG · Shot maker",
    "Three-point and midrange shooting, handling and perimeter defense. Shooting alone cannot cover a weak handle.",
  ],
  [
    "SF · Two-way wing",
    "Finishing, outside shooting and perimeter coverage, with useful rebounding and creation.",
  ],
  [
    "PF · Physical forward",
    "Finishing, rebounding and interior defense. Strength and rebounding are essential.",
  ],
  [
    "C · Paint anchor",
    "Interior defense, both rebounding skills and finishing. Weak paint defense limits the role.",
  ],
  [
    "BENCH · Three reserves",
    "Reserves are rated at their best position. Add shooting, another creator and defensive coverage to support the starters.",
  ],
];
export function RulesPanel({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      className="confirm-dialog rules-dialog"
      eyebrow="THE PLAYBOOK"
      title="Basketball brains. Pokémon stats."
      onClose={onClose}
    >
      <button
        type="button"
        className="text-button rules-close"
        onClick={onClose}
      >
        Close guide
      </button>
      <div className="rules-content">
        <div className="rule-columns">
          <div>
            <h3>Build an eight-player rotation</h3>
            <p>
              <b>82–0 Challenge:</b> choose one of four Pokémon for each slot.
              Fill five starters and three reserves using two re-rolls for the
              entire draft.
            </p>
            <p>
              <b>Lineup builder:</b> search all 251 Generation I and II Pokémon,
              pick or replace any player, swap occupied slots, and use auto-fill
              for an open bench.
            </p>
            <p>
              Each Pokémon can appear only once across the entire league. Your
              eight picks are reserved before the other 29 teams draft their
              rosters. The legendary toggle also controls mythical species. All
              eight slots must be filled before you simulate. Changing modes
              starts a new run. In the Lineup builder the legendary toggle only
              changes the pool and keeps your other picks.
            </p>
          </div>
          <div>
            <h3>A full 30-team league</h3>
            <p>
              All 30 teams play 82 games: 41 home and 41 away, for 1,230 games
              across the league. Every team has five starters and three
              reserves. Your roster, tactic, defense and rotation lock when you
              simulate.
            </p>
            <p>
              Both teams use the same simulation. Shots, free throws, turnovers,
              rebounds, assists, steals and blocks create each box score. Those
              same games determine league standings and player totals. A tie
              triggers overtime.
            </p>
            <p>
              Browse team rosters, compare players and open completed games for
              both teams’ box scores. Your run and records save in this browser.
              The same roster, coaching and season seed reproduce the same
              results.
            </p>
          </div>
        </div>
        <h3>How Pokémon become basketball players</h3>
        <p>
          These are fictional basketball ratings, inspired by each Pokémon’s six
          base stats, height, weight and types. Every basketball skill is on a
          0–100 scale. Legendary status adds no hidden bonus.
        </p>
        <div className="formula-grid">
          <div>
            <strong>Base stats have diminishing returns</strong>
            <span>
              Each stat uses 100 × (1 − exp(−stat / 100)) / (1 − exp(−2)),
              capped at a base stat of 200. Attack feeds finishing and strength;
              special attack and special defense feed shooting, passing and
              composure.
            </span>
          </div>
          <div>
            <strong>Size comes with a cost</strong>
            <span>
              Height and weight use logarithmic curves, capped at 3.5 m and 350
              kg. Reach improves blocks and boards; mass improves strength.
              Heavy bodies lose some court speed, leap and stamina.
            </span>
          </div>
          <div>
            <strong>Types shape skills and matchups</strong>
            <span>
              Types nudge individual skills by at most four points, averaged for
              dual types. Electric players gain speed; Psychic players gain
              passing; Rock players gain strength and lose some speed. New
              seasons also use the 18-type matchup chart: each player uses their
              best attacking type against both of the defender’s types.
              Advantages and resistances modestly change shot odds, pressure and
              blocks. Even immunities become resistance, so every player can
              score.
            </span>
          </div>
          <div>
            <strong>20 skills plus advanced tools</strong>
            <span>
              Six broad skills summarize 14 specialist tools, including shot
              ranges, handles, passing, athleticism, defensive events and
              composure. Advanced tools describe screening, off-ball movement,
              post play, switching, discipline, usage, foul drawing, closeouts
              and decisions. Open a player’s scouting report for every rating
              and the Pokémon source stats.
            </span>
          </div>
          <div>
            <strong>Weak links matter</strong>
            <span>
              Position fit blends a role’s weighted skill average (80%) with its
              weakest essential skill (20%). A high total stat line does not
              guarantee a fit at every position.
            </span>
          </div>
          <div>
            <strong>Build a connected lineup</strong>
            <span>
              Team offense and defense account for playing time, role fit and
              fatigue. Outside shooting creates spacing, creators support the
              offense, and perimeter coverage plus rim protection support the
              defense.
            </span>
          </div>
        </div>
        <h3>Automatic basketball moves</h3>
        <p>
          Coaches choose, train and time moves automatically using a Pokémon’s
          types, physical tools, skills and team needs. These are basketball
          adaptations, separate from battle learnsets. They improve actual
          actions and use energy and cooldowns; they do not guarantee baskets.
          Mastery unlocks a specialization at 75 XP, a third move at 200 XP and
          a fourth at 400 XP. Power trades energy and recharge for strength;
          Control favors support and defense; Efficiency lowers cost and
          recharge with smaller effects. Earned XP follows players through
          trades and seasons. View mastery reports and simulated box scores for
          coach assignments and recorded usage. Older seasons keep their rules;
          moves begin in new seasons. Played arcade games keep their existing
          abilities and controls.
        </p>
        <h3>Signature moves and combo plays</h3>
        <p>
          New seasons include 18 type techniques at 25 mastery XP and 14 species
          or family signatures at 100 XP, such as Pikachu’s Volt Tackle and
          Charizard’s Skyhook. Coaches select eligible moves within existing
          slots and automatically train useful signatures and partnerships.
          Pick-and-roll, pick-and-pop, drive-and-kick and complementary-type
          elemental relays need 25 XP for both partners. Coaches consider
          mastery, earned pair familiarity, current lineup chemistry, energy,
          game clock and cooldowns. Both partners spend energy and their move
          opportunity; interrupted setups earn no shot-created credit. Completed
          combo shots add bounded mastery experience. Reports separate planned
          partnerships, actual setups and shots created from made baskets.
          Chemistry and abilities must be enabled for combos. Existing seasons
          retain their saved move rules; franchises adopt these changes next
          season.
        </p>
        <h3>Find the right role</h3>
        <div className="formula-grid">
          {POSITION_GUIDE.map(([title, description]) => (
            <div key={title}>
              <strong>{title}</strong>
              <span>{description}</span>
            </div>
          ))}
        </div>
        <div className="rule-columns">
          <div>
            <h3>Choose your coaching</h3>
            <p>
              <b>Balanced</b> keeps a broad approach. <b>Run & gun</b> favors
              speed and stamina. <b>Space & shoot</b> rewards perimeter skills.{" "}
              <b>Inside out</b> favors finishing and offensive boards.{" "}
              <b>Defense first</b> trades some offensive rating for defense.
            </p>
            <p>
              A tactic’s value depends on the roster. Fast play adds fatigue
              pressure; a slow, heavy team cannot simply outrun everyone.
            </p>
          </div>
          <div>
            <h3>Minutes and depth</h3>
            <p>
              <b>Balanced</b> spreads the workload. <b>Lean on starters</b>{" "}
              prioritizes the starting five; <b>Use the bench</b> gives reserves
              more opportunities. Coaches choose actual five-player lineups
              throughout the game, accounting for role fit, stamina, foul
              trouble and the opposing five’s types.
            </p>
            <p>
              Regulation lasts 48 minutes and each team’s box score totals 240
              player-minutes. Every five-minute overtime adds 25. Players tire
              while playing and recover on the bench; effective reserves help
              keep the closing lineup fresh.
            </p>
          </div>
        </div>
        <h3>Matchups shape every possession</h3>
        <p>
          Teams use transition attacks, pick-and-rolls, isolation, post play and
          spot-up shots. Ball handling and decisions affect turnovers; screens,
          passing and spacing help create shots. Each shooter faces an actual
          defender, and scoring is tracked at the rim, in midrange and from
          three.
        </p>
        <div className="formula-grid">
          <div>
            <strong>Man to man</strong>
            <span>
              Defenders cover their corresponding court roles. Perimeter skills
              matter outside; strength and interior defense matter in the paint.
            </span>
          </div>
          <div>
            <strong>Switch everything</strong>
            <span>
              Defenders switch assignments against pick-and-rolls. Switching
              reduces the screen advantage, but asks the new defender to handle
              the matchup.
            </span>
          </div>
          <div>
            <strong>Protect the paint</strong>
            <span>
              Zone coverage makes rim shots harder and uses interior defenders
              near the basket, while giving up more three-point opportunities.
            </span>
          </div>
          <div>
            <strong>Full-court pressure</strong>
            <span>
              Pressure creates more turnovers, at the cost of more fouls, faster
              fatigue and easier shots when the offense gets through.
            </span>
          </div>
        </div>
        <h3>Move the defense before taking the shot</h3>
        <p>
          New seasons place all ten players on a modeled half court. Shooting
          threat creates spacing; crowded lanes attract help. Screens, drives,
          passes, kickouts and resets can chain together, using a 24-second shot
          clock. Offensive rebounds restart it at 14 seconds. Long attacks slow
          the game and short clocks force rushed shots or turnovers.
        </p>
        <p>
          CPU coaches choose drop, switch, hedge, trap or under coverage for
          each screen using shooting threat, mobility, passing and body/type
          matchups. Help and recovery take time. Game insights show each action
          chain, coverage choice and final court positions for both teams. These
          rules apply to every simulated regular-season and playoff game.
          Existing standard franchises upgrade next season; historical results
          and existing local-career rules remain frozen.
        </p>
        <h3>Make the physical matchup count</h3>
        <p>
          New simulated seasons resolve post position and separation before a
          shot. Height and weight shape reach, contact leverage, turning speed
          and workload. A heavy Pokémon can seal a smaller defender or set a
          stronger screen, but a quick opponent can attack it in space. Long
          rebounds favor pursuit; short rebounds favor reach and position.
        </p>
        <p>
          Coaches consider these differences together with typing when choosing
          attacks, defenders, switches and help. The matchup explorer previews
          those contests. Game insights show the actual matchups and advantages
          created. Catalog dimensions are compressed into game traits, so
          extreme size never guarantees success.
        </p>
        <h3>Use each species’ ability</h3>
        <p>
          New games use the species’ first normal Pokémon ability with a
          basketball adaptation shown in scouting. Effects change shot
          probability when their conditions apply: a shooter can improve a
          finish, a passer can help a teammate, or a defender can challenge a
          shot. Local leagues can turn abilities off. Earlier games keep their
          original rules.
        </p>
        <p>
          Game boxes, season and playoff statistics, and career pages show
          offensive, support and defensive activations. Counts include misses
          whenever the effect applied; they do not measure baskets made or
          points caused. An unavailable entry means no ability data was
          recorded. Played-game activations count actual court actions and are
          not multiplied by the official score conversion. Coaches consider
          enabled abilities in their plans, rotations and training.
        </p>
        <h3>Play the type matchup</h3>
        <p>
          Offenses look for favorable type matchups while still valuing
          basketball skills. A switch changes the defending Pokémon, and help
          defenders can soften a type mismatch at the rim. Electric pressure
          threatens Water players; Ground resists Electric. Dual types can
          create stronger weaknesses, cancel a weakness, or offer another
          attacking option.
        </p>
        <p>
          Coaches scout the opposing five before tipoff and reassess each
          minute. They can bring in a bench counter or move a player into a
          better court matchup, weighing both attacking coverage and defensive
          resistance. Basketball ability, fatigue and foul trouble still matter;
          custom minute targets and chosen closing players remain in effect.
          Arcade opponents reassess at dead balls after your queued
          substitutions, with a short cooldown to avoid constant swapping.
        </p>
        <p>
          New simulated seasons assign defenders using type resistance, role fit
          and fatigue. Screens can create switches or rolls; help defense can
          leave a shooter open for a pass. Coaches remember each opponent’s
          scoring threats, switches and help rotations from completed games,
          giving recent meetings more weight. That scouting carries into the
          playoffs and updates after each series game. It resets for a new
          season. Game reports show the decisions and prior meetings used.
        </p>
        <p>
          Type effects on shot chance stay within about seven percentage points.
          Free throws are unaffected. Scouting shows coverage and weaknesses;
          the matchup explorer explains shot odds, and game reports count actual
          advantaged and resisted attacks. Older saved seasons retain their
          original rules; typing activates with a new run or the next franchise
          season.
        </p>
        <h3>Fouls, closing lineups and overtime</h3>
        <p>
          Lineups can change each minute, with immediate replacements after a
          player’s sixth foul. In a close game, the final four minutes favor
          fit, energy and composure. Trailing teams may chase threes or foul
          intentionally late. A tied game continues in five-minute overtimes
          until a winner emerges.
        </p>
        <p>
          The fifth defensive team foul in a quarter, or fourth in overtime,
          puts the opponent in the bonus. Offensive fouls cause turnovers and do
          not count toward that bonus. Missed final free throws can be
          rebounded, and offensive rebounds keep the possession alive.
        </p>
        <p>
          If fewer than five players remain below six fouls, the minimum number
          of disqualified players return to keep the game five-on-five. Every
          further personal foul by a returned player also gives the opponent a
          technical free throw.
        </p>
        <h3>Follow production, earn league honors</h3>
        <p>
          When the season reveal finishes, compare per-game numbers, totals,
          shooting percentages, true shooting and game highs across all 240
          players. Season totals are the sum of the actual game box scores.
        </p>
        <p>
          Six <b>league awards</b> recognize MVP, Defensive Player of the Year,
          Sixth Player of the Year and the scoring, assist and rebounding
          champions, with finalists for each award. All-League and All-Defense
          each select five players. A player must appear in at least 58 games to
          qualify; the Sixth Player must start fewer than half of their games.
        </p>
        <p>
          MVP and Sixth Player combine per-game production and efficiency with
          availability and team wins. Defensive Player rewards steals, blocks
          and defensive rebounds, with deductions for fouls and adjustments for
          availability and wins. The three statistical champions lead in points,
          assists or rebounds per game. Exact ties use team ID, then Pokédex
          number.
        </p>
        <h3>Sixteen teams. One champion.</h3>
        <p>
          The top 16 teams qualify for a fixed playoff bracket. Seeds use
          regular-season wins, then point differential, then team ID. Every
          series is best of seven; the higher seed hosts games 1, 2, 5 and 7.
          Winners advance without reseeding through the quarterfinals,
          semifinals and Finals. A series ends at four wins.
        </p>
        <p>
          Advance one slate of games, finish the current round, or simulate the
          rest of the playoffs. You can follow the bracket even if your team
          misses qualification or is eliminated. Playoff player statistics and
          every game box score are separate from regular-season totals. Finals
          MVP rewards total production and efficiency during the Finals among
          players on the championship team.
        </p>
        <h3>Keep building your franchise</h3>
        <p>
          After the Finals, choose <b>Continue as franchise</b>. Your completed
          season becomes Year 1. Development changes basketball skills based on
          minutes, production and individual training. The report explains each
          player's gains and declines. Other clubs can make up to six trades,
          with at most one deal per club; your players are never traded
          automatically.
        </p>
        <p>
          Search the trade market by player, club, position or availability.
          Offer one, two or three players for the same number from one club.
          Other clubs consider talent, coaching, position coverage, development
          and their recent season. Available, Listening and Core player labels
          describe asking price. Use <b>Find deals</b> for accepted suggestions
          around a target or outgoing package, then review the offer. The search
          checks a limited set of packages, and every deal is evaluated again
          before execution. Trades preserve eight players per club and unique
          species across the league.
        </p>
        <p>
          During the offseason, swap any two roster slots, promote reserves, and
          set offense, defense and rotation. You can assign 240 minutes and five
          positive-minute closers. Minutes belong to slots, so a trade or rookie
          replacement inherits its destination's minutes. Retained players keep
          their development and training plans. These changes carry into the
          next season while completed games stay unchanged.
        </p>
        <h3>A new rookie class every offseason</h3>
        <p>
          After development, begin a two-round rookie draft: 30 picks in each
          round. The worst prior-season record picks first, with lower point
          differential and then club ID breaking ties. Both rounds use the same
          order. Your first class is Generation III, followed by IV through IX.
          Existing franchises begin with Generation III when they first draft.
        </p>
        <p>
          Search prospects, filter by position and inspect scouting reports.
          Choose both a rookie and the owned player they replace, or use the
          displayed coaching recommendation. Every pick keeps the club at eight
          players. CPU clubs draft for ability and roster need, advancing to
          your next turn; the board shows every pick and release. Trades pause
          while a draft is incomplete, and the draft must finish before you
          start the next season.
        </p>
        <p>
          After Generation IX, classes draw from remaining eligible
          later-generation prospects. Anyone previously drafted or rostered is
          ineligible, even after release. The legendary setting applies to
          rookies. If no eligible prospects remain, the board explains that the
          remaining picks were skipped and you can continue the franchise.
        </p>
        <p>
          Start the next season with a fresh schedule, set your positions and
          coaching, then play another regular season and playoffs. Career totals
          follow each Pokémon across trades and remain after a rookie-draft
          release, with regular-season and playoff statistics kept separately.
          Season history preserves league awards, All-League and All-Defense
          selections, champions and Finals MVPs. Championship rings belong to
          all eight players on the winning roster.
        </p>
        <p>
          Newly archived seasons preserve frozen rosters, coaching and full game
          details. Earlier saves without detailed archives still retain their
          records, rosters, honors and career totals. Franchise seasons do not
          add attempts to your 82–0 Challenge or Lineup builder records.
          Progress saves in this browser; ending a franchise replaces its
          history with a new draft.
        </p>
        <p>
          Older saves keep their original results and records. Completed league
          seasons can start playoffs immediately. Five-player seasons remain
          archived recaps. Earlier eight-player seasons retain their personal
          statistics, box scores and team awards; those honors remain awards
          within your roster. Start a new season to play the full league and
          earn league honors.
        </p>
      </div>
    </Dialog>
  );
}
