// Express 가져오기
const express = require('express');
const router = express.Router();


// 관광지 주소를 관리할 router 만들기
// GET 요청을 받는 주소 만들기
    // 임시 관광지 목록 만들기
    // 관광지 목록을 JSON으로 응답하기
router.get('/', (req, res) => {
    const regions = [
        {id : 1, name : '청송읍', location : '경상북도 청송군 청송읍', description : '청송읍은 경상북도 청송군의 중심지로, 아름다운 자연경관과 다양한 문화유산이 있는 지역입니다.', image : '', recommendedFor : []},
        {id : 2, name : '주왕산', location : '경상북도 청송군 부남면', description : '주왕산은 경상북도 청송군에 위치한 산으로, 아름다운 산세와 다양한 등산로가 있어 많은 관광객들이 찾는 명소입니다.', image : '', recommendedFor : []}
    ];
    res.json(regions);
});
// router를 app.js에서 쓸 수 있도록 내보내기
module.exports = router;