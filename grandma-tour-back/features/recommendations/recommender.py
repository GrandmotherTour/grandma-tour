# Top 3 계산
# Node.js의 service 데이터를 python에 전달

import json
import sys
from ortools.sat.python import cp_model

MATCH_WEIGHT = 30
PREF_OBJECTIVE_WEIGHT = 4
TRAVEL_PENALTY = 2
WAIT_PENALTY = 1
COVERAGE_BONUS = 15
DEFAULT_TRAVEL_MIN = 20


def main():
    payload = json.loads(sys.stdin.read())
    routes = recommend(payload, top_n=int(payload.get("topN", 3)))
    print(json.dumps({"routes": routes}, ensure_ascii=False))


def recommend(payload, top_n=3):
    survey = payload["survey"]
    selected = set(map(int, payload["selectedKeywordIds"]))
    excluded = set(map(int, payload["excludedKeywordIds"]))
    point_keywords = {
        int(point_id): set(map(int, keyword_ids))
        for point_id, keyword_ids in payload["pointKeywords"].items()
    }

    points = []
    for point in payload["points"]:
        point_id = int(point["id"])
        if point_keywords.get(point_id, set()) & excluded:
            continue

        lo = max(int(point["open_min"]), int(survey["start_min"]))
        hi = min(
            int(point["close_min"]) - int(point["duration_min"]),
            int(survey["end_min"]) - int(point["duration_min"]),
        )
        if lo <= hi:
            points.append(point)

    travel = {}
    for row in payload["travelTimes"]:
        travel[(int(row["fromPointId"]), int(row["toPointId"]))] = int(row["travelMin"])

    all_routes = []
    max_points = min(int(survey["max_points"]), len(points))

    for route_len in range(int(survey["min_points"]), max_points + 1):
        excluded_sequences = []

        for _ in range(top_n):
            route = solve_once(
                survey=survey,
                points=points,
                point_keywords=point_keywords,
                selected=selected,
                travel=travel,
                route_len=route_len,
                excluded_sequences=excluded_sequences,
            )

            if route is None:
                break

            excluded_sequences.append(tuple(stop["pointId"] for stop in route["stops"]))
            all_routes.append(route)

    all_routes.sort(
        key=lambda route: (
            route["score"],
            route["coveredKeywordCount"],
            route["matchedKeywordCount"],
            -route["totalTravelMin"],
        ),
        reverse=True,
    )

    result = all_routes[:top_n]
    for index, route in enumerate(result, start=1):
        route["rank"] = index
    return result


def solve_once(survey, points, point_keywords, selected, travel, route_len, excluded_sequences):
    model = cp_model.CpModel()
    all_i = range(len(points))
    all_k = range(route_len)

    x = {i: model.new_bool_var(f"x[{i}]") for i in all_i}
    y = {(i, k): model.new_bool_var(f"y[{i},{k}]") for i in all_i for k in all_k}
    z = {
        (i, j, k): model.new_bool_var(f"z[{i},{j},{k}]")
        for i in all_i
        for j in all_i
        if i != j
        for k in range(route_len - 1)
    }

    start = {}
    for i, point in enumerate(points):
        lo = max(int(point["open_min"]), int(survey["start_min"]))
        hi = min(
            int(point["close_min"]) - int(point["duration_min"]),
            int(survey["end_min"]) - int(point["duration_min"]),
        )

        domain = cp_model.Domain.from_intervals([[-1, -1], [lo, hi]])
        start[i] = model.new_int_var_from_domain(domain, f"start[{i}]")
        model.add(start[i] == -1).only_enforce_if(x[i].Not())
        model.add(start[i] >= 0).only_enforce_if(x[i])

    wait = {
        k: model.new_int_var(0, int(survey["end_min"]) - int(survey["start_min"]), f"wait[{k}]")
        for k in range(route_len - 1)
    }

    model.add(sum(x[i] for i in all_i) == route_len)

    for i in all_i:
        model.add(sum(y[i, k] for k in all_k) == x[i])

    for k in all_k:
        model.add(sum(y[i, k] for i in all_i) == 1)

    for k in range(route_len - 1):
        model.add(sum(z[i, j, k] for i in all_i for j in all_i if i != j) == 1)

        for i in all_i:
            for j in all_i:
                if i == j:
                    continue

                model.add(z[i, j, k] <= y[i, k])
                model.add(z[i, j, k] <= y[j, k + 1])
                model.add(z[i, j, k] >= y[i, k] + y[j, k + 1] - 1)

                from_id = int(points[i]["id"])
                to_id = int(points[j]["id"])
                travel_min = travel.get((from_id, to_id), DEFAULT_TRAVEL_MIN)

                model.add(
                    start[j] >= start[i] + int(points[i]["duration_min"]) + travel_min
                ).only_enforce_if(z[i, j, k])

                model.add(
                    wait[k] == start[j] - start[i] - int(points[i]["duration_min"]) - travel_min
                ).only_enforce_if(z[i, j, k])

    point_id_to_index = {int(point["id"]): i for i, point in enumerate(points)}
    for sequence in excluded_sequences:
        vars_to_exclude = [
            y[point_id_to_index[point_id], k]
            for k, point_id in enumerate(sequence)
            if point_id in point_id_to_index
        ]
        if len(vars_to_exclude) == route_len:
            model.add(sum(vars_to_exclude) <= route_len - 1)

    keyword_used = {}
    for keyword_id in selected:
        used = model.new_bool_var(f"keyword_used[{keyword_id}]")
        matching = [
            i for i, point in enumerate(points)
            if keyword_id in point_keywords.get(int(point["id"]), set())
        ]

        if not matching:
            model.add(used == 0)
        else:
            count = sum(x[i] for i in matching)
            model.add(count >= used)
            model.add(count <= route_len * used)

        keyword_used[keyword_id] = used

    pref_scores = []
    for point in points:
        point_id = int(point["id"])
        matched_count = len(point_keywords.get(point_id, set()) & selected)
        pref_scores.append(matched_count * MATCH_WEIGHT)

    pref_term = sum(pref_scores[i] * x[i] for i in all_i)

    travel_term = sum(
        travel.get((int(points[i]["id"]), int(points[j]["id"])), DEFAULT_TRAVEL_MIN) * z[i, j, k]
        for i in all_i
        for j in all_i
        if i != j
        for k in range(route_len - 1)
    )

    wait_term = sum(wait[k] for k in range(route_len - 1))
    coverage_term = sum(keyword_used.values())

    model.maximize(
        PREF_OBJECTIVE_WEIGHT * pref_term
        - TRAVEL_PENALTY * travel_term
        - WAIT_PENALTY * wait_term
        + COVERAGE_BONUS * coverage_term
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 2.0
    solver.parameters.num_search_workers = 4

    status = solver.solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None

    route_indices = []
    for k in all_k:
        for i in all_i:
            if solver.value(y[i, k]) == 1:
                route_indices.append(i)
                break

    return read_solution(
        solver=solver,
        status=status,
        points=points,
        route_indices=route_indices,
        start=start,
        point_keywords=point_keywords,
        selected=selected,
        travel=travel,
    )


def read_solution(solver, status, points, route_indices, start, point_keywords, selected, travel):
    stops = []
    total_travel = 0
    matched_count = 0
    covered = set()

    for order, point_index in enumerate(route_indices, start=1):
        point = points[point_index]
        point_id = int(point["id"])
        matched = point_keywords.get(point_id, set()) & selected

        matched_count += len(matched)
        covered.update(matched)

        if order > 1:
            prev = points[route_indices[order - 2]]
            total_travel += travel.get((int(prev["id"]), point_id), DEFAULT_TRAVEL_MIN)

        stops.append({
            "pointId": point_id,
            "pointName": point["name"],
            "guideId": int(point["guide_id"]),
            "visitOrder": order,
            "arrivalMin": solver.value(start[point_index]),
            "stayMin": int(point["duration_min"]),
        })

    total_duration = (
        stops[-1]["arrivalMin"]
        + stops[-1]["stayMin"]
        - stops[0]["arrivalMin"]
    )

    return {
        "rank": 0,
        "score": int(round(solver.objective_value)),
        "totalTravelMin": total_travel,
        "totalDurationMin": total_duration,
        "matchedKeywordCount": matched_count,
        "coveredKeywordCount": len(covered),
        "solverStatus": solver.status_name(status),
        "stops": stops,
    }


if __name__ == "__main__":
    main()
