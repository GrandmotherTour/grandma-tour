// Express 가져오기
const express = require('express');
const router = express.Router();
// ** back이랑 db 연결하기
// 1. db mysql 가져오기
const pool = require("../../config/db");

// 관광지 목록 조회
router.get("/", async (req, res) => {

    // ② DB 조회 중 오류가 발생할 수 있으므로 예외 처리 시작
    try {

        // ③ regions 테이블의 모든 데이터 조회하기
        const [rows] = await pool.query(
            "SELECT * FROM regions" 
        );

        // ④ DB에서 조회한 지역 목록을 JSON으로 응답하기
        res.json(rows);

    // ⑤ 오류가 발생했을 때 실행되는 부분
    } catch (error) {

        console.error("지역 목록 조회 오류:", error);

        // ⑥ 서버 오류 상태 코드와 메시지 응답하기
        res.status(500).json({
            message: "지역 목록을 불러오지 못했습니다."
        });
    }
});
// router를 app.js에서 쓸 수 있도록 내보내기
module.exports = router;